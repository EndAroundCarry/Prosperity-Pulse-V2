/**
 * pp-quote-tile — the fundamental dashboard tile.
 *
 * Shows: symbol label, price, absolute + % change with arrow,
 * sparkline, and an "as of" date.  Used for index proxies,
 * sectors, crypto, FX, and commodities.
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PpSparklineComponent } from './pp-sparkline.component';
import { QuoteSnapshot } from '../../models/instrument.model';

@Component({
  selector: 'pp-quote-tile',
  standalone: true,
  imports: [CommonModule, RouterModule, PpSparklineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [routerLink]="['/ticker', snapshot.symbol]"
      class="quote-tile"
      [class.positive]="snapshot.changePercent >= 0"
      [class.negative]="snapshot.changePercent < 0"
      [attr.aria-label]="ariaLabel"
    >
      <div class="tile-top">
        <div class="symbol-info">
          <span class="symbol-name">{{ displayName }}</span>
          <span class="symbol-ticker">{{ snapshot.symbol }}</span>
        </div>
        @if (snapshot.sparkline && snapshot.sparkline.length > 1) {
          <pp-sparkline
            [data]="snapshot.sparkline"
            [positive]="snapshot.changePercent >= 0"
            [width]="64"
            [height]="24"
          />
        }
      </div>

      <div class="tile-price">
        <span class="price">{{ formatPrice(snapshot.price) }}</span>
      </div>

      <div class="tile-change">
        <span class="change-arrow">{{ snapshot.changePercent >= 0 ? '▲' : '▼' }}</span>
        <span class="change-abs">{{ formatChange(snapshot.change) }}</span>
        <span class="change-pct">({{ formatPercent(snapshot.changePercent) }})</span>
      </div>

      <div class="tile-asof">
        Close, {{ formatDate(snapshot.asOf) }}
      </div>
    </a>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .quote-tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 14px;
      border-radius: 0.75rem;
      border: 1px solid rgba(0,0,0,0.06);
      background: #fff;
      text-decoration: none;
      color: inherit;
      transition: box-shadow 0.15s, transform 0.15s;
      height: 100%;
      box-sizing: border-box;
    }
    .quote-tile:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      transform: translateY(-1px);
    }
    :host-context(.dark-mode) .quote-tile {
      background: #1e293b;
      border-color: #334155;
    }
    .tile-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .symbol-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .symbol-name {
      font-size: 0.75rem;
      font-weight: 600;
      color: #334155;
    }
    :host-context(.dark-mode) .symbol-name {
      color: #e2e8f0;
    }
    .symbol-ticker {
      font-size: 0.625rem;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .tile-price {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
    }
    :host-context(.dark-mode) .tile-price {
      color: #f1f5f9;
    }
    .tile-change {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .positive .tile-change { color: #16a34a; }
    .negative .tile-change { color: #dc2626; }
    :host-context(.dark-mode) .positive .tile-change { color: #4ade80; }
    :host-context(.dark-mode) .negative .tile-change { color: #f87171; }
    .change-arrow { font-size: 0.625rem; }
    .change-abs { }
    .change-pct { opacity: 0.8; }
    .tile-asof {
      font-size: 0.625rem;
      color: #94a3b8;
      margin-top: 2px;
    }
  `],
})
export class PpQuoteTileComponent {
  @Input() snapshot!: QuoteSnapshot;
  @Input() displayName = '';

  get ariaLabel(): string {
    if (!this.snapshot) return '';
    const dir = this.snapshot.changePercent >= 0 ? 'up' : 'down';
    return `${this.displayName || this.snapshot.symbol}, ` +
      `${this.formatPrice(this.snapshot.price)} dollars, ` +
      `${dir} ${Math.abs(this.snapshot.changePercent).toFixed(2)} percent, ` +
      `as of ${this.formatDate(this.snapshot.asOf)}`;
  }

  formatPrice(val: number): string {
    return val >= 1000
      ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : val.toFixed(2);
  }

  formatChange(val: number): string {
    const sign = val >= 0 ? '+' : '';
    return sign + (val >= 1000
      ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : val.toFixed(2));
  }

  formatPercent(val: number): string {
    const sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(2) + '%';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }
}
