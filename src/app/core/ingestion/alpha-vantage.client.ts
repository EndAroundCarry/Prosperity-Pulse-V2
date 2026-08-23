/**
 * The only place `HttpClient` touches Alpha Vantage.
 *
 * Handles the four response shapes the current code ignores:
 * - { "Note": ... }          → rate-limited, mark quota exhausted
 * - { "Information": ... }   → premium-gated OR quota exhausted
 * - { "Error Message": ... } → bad symbol/params, disable dataset
 * - Normal JSON/CSV data     → pass through to persist handler
 *
 * CSV endpoints return `text/csv` — parsed inline with a ~30-line
 * quoted-field parser (no external library needed for these feeds).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { QuotaLedgerService } from './quota-ledger.service';
import { DatasetDefinition } from './dataset-registry';

const API_URL = 'https://www.alphavantage.co/query';

export interface PersistContext {
  /** The dataset that was fetched (for stamping state after persist) */
  dataset: DatasetDefinition;
  /** Firestore instance for writing documents */
  firestore: import('@angular/fire/firestore').Firestore;
}

export interface FetchResult {
  ok: boolean;
  /** If ok, the raw response data (parsed JSON or CSV string) */
  data?: unknown;
  /** If !ok, the reason */
  error?: 'rate_limited' | 'premium_gated' | 'bad_params' | 'http_error';
  /** Human-readable detail for logging */
  detail?: string;
}

@Injectable({ providedIn: 'root' })
export class AlphaVantageClient {
  private readonly http = inject(HttpClient);
  private readonly quota = inject(QuotaLedgerService);

  /**
   * Fetch one dataset from Alpha Vantage.  Returns structured
   * result so the caller (scheduler) can decide how to handle errors.
   */
  async fetch(dataset: DatasetDefinition, apiKey: string): Promise<FetchResult> {
    const params: Record<string, string> = {
      ...dataset.params,
      apikey: apiKey,
    };

    // CSV endpoints need responseType: 'text'
    const isCSV = dataset.format === 'csv';
    const options = isCSV
      ? { responseType: 'text' as const, headers: new HttpHeaders({ Accept: 'text/csv' }) }
      : {};

    try {
      const response = isCSV
        ? await firstValueFrom(this.http.get(API_URL, { params, responseType: 'text', observe: 'body' }))
        : await firstValueFrom(this.http.get(API_URL, { params }));

      // Check for Alpha Vantage error envelopes
      if (isCSV) {
        // CSV endpoints return plain text; check for JSON error embedded
        const text = response as unknown as string;
        if (text.startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            return this.classifyJsonError(parsed, dataset);
          } catch {
            // Not JSON — proceed as valid CSV
          }
        }
        return { ok: true, data: text };
      }

      // JSON response — check for error shapes
      return this.classifyJsonError(response as Record<string, unknown>, dataset);
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        return {
          ok: false,
          error: 'http_error',
          detail: `HTTP ${err.status}: ${err.statusText}`,
        };
      }
      return {
        ok: false,
        error: 'http_error',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Classify an Alpha Vantage JSON response.  The API returns 200
   * even for errors — the error info is in the body.
   */
  private classifyJsonError(
    response: Record<string, unknown>,
    dataset: DatasetDefinition
  ): FetchResult {
    // Rate limited: { "Note": "..." }
    if ('Note' in response) {
      return {
        ok: false,
        error: 'rate_limited',
        detail: String(response['Note']),
      };
    }

    // Premium-gated or quota exhausted: { "Information": "..." }
    if ('Information' in response) {
      const msg = String(response['Information']);
      const isPremium =
        /premium/i.test(msg) ||
        /upgrade/i.test(msg) ||
        /subscribe/i.test(msg);
      return {
        ok: false,
        error: isPremium ? 'premium_gated' : 'rate_limited',
        detail: msg,
      };
    }

    // Bad params / unknown symbol: { "Error Message": "..." }
    if ('Error Message' in response) {
      return {
        ok: false,
        error: 'bad_params',
        detail: String(response['Error Message']),
      };
    }

    // Looks like valid data
    return { ok: true, data: response };
  }
}

// ────────────────────────────────────────────────────────────
// Minimal CSV parser (no library)
// Handles quoted fields with commas/newlines inside quotes,
// which is what Alpha Vantage calendar CSVs use.
// ────────────────────────────────────────────────────────────

export function parseCsvLine(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++; // skip \r\n
        }
        current.push(field);
        field = '';
        if (current.length > 1 || current[0] !== '') {
          lines.push(current);
        }
        current = [];
      } else {
        field += ch;
      }
    }
  }

  // Flush last field/line
  current.push(field);
  if (current.length > 1 || current[0] !== '') {
    lines.push(current);
  }

  return lines;
}
