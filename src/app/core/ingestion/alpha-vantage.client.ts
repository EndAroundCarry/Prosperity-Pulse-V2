import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DatasetDefinition } from './dataset-registry';
import { environment } from '../../../environments/environment';

export type AlphaVantageErrorKind = 'rate-limited' | 'premium-gated' | 'bad-request' | 'network';

export interface AlphaVantageError {
  kind: AlphaVantageErrorKind;
  /** The raw message from Alpha Vantage (or the network error). */
  message: string;
  /** Set when the message names a premium plan — the dataset is permanently disabled. */
  premiumPlan?: string;
}

export const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query';

/**
 * Parse an Alpha Vantage JSON response body and classify it.
 *
 * Alpha Vantage never returns 4xx for quota/premium problems — it returns
 * HTTP 200 with an `Information` or `Note` field. The current code ignores
 * all of these shapes, which is why the app silently renders empty.
 */
export function classifyResponse(body: unknown): { error: AlphaVantageError } | { data: unknown } {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;

    // Rate limited: {"Note": "Your API access frequency is restricted..."}
    if (typeof record['Note'] === 'string' && record['Note']!.length > 0) {
      return { error: { kind: 'rate-limited', message: record['Note'] as string } };
    }

    // Premium-gated or quota exhausted: {"Information": "Thank you for using
    // Alpha Vantage! ... premium endpoint ... your API plan ..."}
    if (typeof record['Information'] === 'string' && record['Information']!.length > 0) {
      const message = record['Information'] as string;
      const lower = message.toLowerCase();
      const premiumPlan = /premium|enterprise|advanced|ultra/i.test(lower) ? message : undefined;
      return {
        error: {
          kind: premiumPlan ? 'premium-gated' : 'rate-limited',
          message,
          premiumPlan,
        },
      };
    }

    // Bad symbol/params: {"Error Message": "Invalid API call..."}
    if (typeof record['Error Message'] === 'string' && record['Error Message']!.length > 0) {
      return { error: { kind: 'bad-request', message: record['Error Message'] as string } };
    }
  }

  return { data: body };
}

/** A minimal CSV parser for the well-formed Alpha Vantage CSV feeds. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== header.length) continue;
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = values[idx];
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * The only place HttpClient touches Alpha Vantage.
 *
 * Handles the response shapes the current code ignores:
 * - `Note` → rate limited → mark quota exhausted, back off to Eastern midnight.
 * - `Information` → premium-gated (permanently disable that dataset) or quota.
 * - `Error Message` → bad params → disable that dataset, don't retry.
 * - CSV endpoints → request as text and parse with the built-in parser.
 */
@Injectable({ providedIn: 'root' })
export class AlphaVantageClient {
  private readonly http = inject(HttpClient);

  async fetchDataset(dataset: DatasetDefinition): Promise<unknown> {
    const params = new HttpParams({
      fromObject: {
        ...dataset.params,
        apikey: environment.alphaVantageKey,
      },
    });

    const responseType = dataset.format === 'csv' ? 'text' : 'json';
    const body = await firstValueFrom(
      this.http.get(ALPHA_VANTAGE_URL, { params, responseType: responseType as 'json' })
    );

    if (dataset.format === 'csv') {
      return parseCsv(body as string);
    }

    const classified = classifyResponse(body);
    if ('error' in classified) {
      throw classified.error;
    }
    return classified.data;
  }
}
