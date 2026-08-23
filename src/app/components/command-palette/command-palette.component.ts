/**
 * CommandPaletteComponent — Ctrl/Cmd+K global search.
 *
 * Opens as a dialog overlay with a search input.  Autocomplete
 * results come from the SearchService (LISTING_STATUS universe).
 * Clicking a result navigates to /ticker/:symbol.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { SearchService, SearchResult } from '../../services/search.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="palette-backdrop" (click)="close()">
      <div class="palette-container" (click)="$event.stopPropagation()">
        <div class="palette-input-row">
          <mat-icon class="palette-search-icon">search</mat-icon>
          <input
            #searchInput
            type="text"
            [(ngModel)]="query"
            (ngModelChange)="onSearch($event)"
            placeholder="Search tickers… e.g. AAPL, Bitcoin, Tesla"
            class="palette-input"
            aria-label="Search stock tickers"
            autofocus
          />
          <span class="palette-shortcut">ESC</span>
        </div>

        @if (results.length > 0) {
          <div class="palette-results">
            @for (result of results; track result.symbol) {
              <button
                class="palette-result"
                (click)="navigateTo(result.symbol)"
                [attr.aria-label]="'Go to ' + result.symbol + ' — ' + result.name"
              >
                <div class="result-symbol">{{ result.symbol }}</div>
                <div class="result-info">
                  <span class="result-name">{{ result.name }}</span>
                  <span class="result-meta">{{ result.exchange }} · {{ result.type }}</span>
                </div>
                <mat-icon class="result-arrow">arrow_forward</mat-icon>
              </button>
            }
          </div>
        } @else if (query.length > 0 && !loading) {
          <div class="palette-empty">
            <mat-icon>search_off</mat-icon>
            <span>No results for "{{ query }}"</span>
          </div>
        } @else if (loading) {
          <div class="palette-empty">
            <span>Searching…</span>
          </div>
        } @else {
          <div class="palette-hints">
            <span>Type a symbol or company name to search</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .palette-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      z-index: 1000;
    }
    .palette-container {
      width: 560px;
      max-width: 90vw;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    :host-context(.dark-mode) .palette-container {
      background: #1e293b;
      border-color: #334155;
    }
    .palette-input-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark-mode) .palette-input-row {
      border-color: #334155;
    }
    .palette-search-icon {
      color: #94a3b8;
    }
    .palette-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 1rem;
      color: #0f172a;
      font-family: inherit;
    }
    :host-context(.dark-mode) .palette-input {
      color: #f1f5f9;
    }
    .palette-input::placeholder {
      color: #94a3b8;
    }
    .palette-shortcut {
      font-size: 0.6875rem;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 6px;
      font-weight: 600;
    }
    :host-context(.dark-mode) .palette-shortcut {
      background: #334155;
      color: #64748b;
    }
    .palette-results {
      max-height: 360px;
      overflow-y: auto;
      padding: 8px;
    }
    .palette-result {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border: none;
      background: transparent;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: background 0.1s;
    }
    .palette-result:hover,
    .palette-result:focus-visible {
      background: #f1f5f9;
      outline: none;
    }
    :host-context(.dark-mode) .palette-result:hover {
      background: #334155;
    }
    .result-symbol {
      font-size: 0.875rem;
      font-weight: 700;
      color: #3b82f6;
      min-width: 64px;
    }
    .result-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .result-name {
      font-size: 0.8125rem;
      color: #334155;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark-mode) .result-name {
      color: #e2e8f0;
    }
    .result-meta {
      font-size: 0.6875rem;
      color: #94a3b8;
    }
    .result-arrow {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #cbd5e1;
    }
    .palette-empty,
    .palette-hints {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px;
      color: #94a3b8;
      font-size: 0.8125rem;
    }
  `],
})
export class CommandPaletteComponent implements AfterViewInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly dialogRef = inject(MatDialogRef);
  private readonly cdr = inject(ChangeDetectorRef);

  query = '';
  results: SearchResult[] = [];
  loading = false;
  private searchSub?: Subscription;

  ngAfterViewInit(): void {
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
    }
  }

  onSearch(query: string): void {
    this.loading = true;
    this.searchSub?.unsubscribe();
    this.searchSub = this.searchService.search(query).subscribe((results) => {
      this.results = results;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  navigateTo(symbol: string): void {
    this.router.navigate(['/ticker', symbol]);
    this.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}
