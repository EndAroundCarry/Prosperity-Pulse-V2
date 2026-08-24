import { Component, computed, input, output } from '@angular/core';
import { Candle, FundamentalsDoc } from '../../models/instrument.model';

/**
 * Ticker page header — price, change, range, and the honest "queued"
 * notice when there is no cached data yet.
 */
@Component({
  selector: 'pp-ticker-header',
  standalone: true,
  imports: [],
  template: `
    <div class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      @if (candles() === null) {
        <p class="mb-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          Price data queued — arriving within the hour. This page will fill in automatically.
        </p>
      }
      <div class="flex items-baseline gap-3 flex-wrap">
        <h1 class="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{{ symbol() }}</h1>
        @if (companyName(); as name) {
          <span class="text-sm text-slate-500 dark:text-slate-400">{{ name }}</span>
        }
      </div>

      @if (last(); as c) {
        <div class="mt-2 flex items-end gap-4">
          <span class="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
            {{ c.close.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
          </span>
          <span class="text-sm font-bold tabular-nums"
                [class.text-cyan-700]="changeValue() >= 0" [class.dark:text-cyan-400]="changeValue() >= 0"
                [class.text-orange-600]="changeValue() < 0" [class.dark:text-orange-400]="changeValue() < 0">
            {{ changeValue() >= 0 ? '▲' : '▼' }} {{ signed(changeValue()) }} ({{ signed(changePct()) }}%)
          </span>
          <time class="text-[11px] text-slate-400">Close, {{ lastDate() }}</time>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">
          {{ candles()!.length }} trading days loaded · range {{ rangeLow().toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
          –{{ rangeHigh().toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
        </p>
      }

      <!-- Watchlist toggle (localStorage guest flow; Firestore sync is Phase 6) -->
      <button type="button" (click)="toggleWatchlist()"
        class="mt-4 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors"
        [class]="inWatchlist()
          ? 'border-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300'
          : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'">
        {{ inWatchlist() ? '★ In watchlist' : '☆ Add to watchlist' }}
      </button>
    </div>
  `,
})
export class TickerHeaderComponent {
  readonly symbol = input.required<string>();
  readonly candles = input<Candle[] | null>(null);
  readonly fundamentals = input<FundamentalsDoc | null>(null);
  readonly inWatchlist = input(false);

  readonly toggle = output<boolean>();

  readonly companyName = computed(() => this.fundamentals()?.overview?.name ?? null);

  readonly last = computed(() => {
    const cs = this.candles();
    return cs && cs.length > 0 ? cs[cs.length - 1] : null;
  });

  readonly previousClose = computed(() => {
    const cs = this.candles();
    return cs && cs.length > 1 ? cs[cs.length - 2].close : null;
  });

  readonly changeValue = computed(() => {
    const l = this.last();
    const p = this.previousClose();
    return l && p !== null ? l.close - p : 0;
  });

  readonly changePct = computed(() => {
    const l = this.last();
    const p = this.previousClose();
    return l && p !== null && p !== 0 ? ((l.close - p) / p) * 100 : 0;
  });

  readonly rangeLow = computed(() => Math.min(...(this.candles() ?? []).map((c) => c.low), Infinity) || 0);
  readonly rangeHigh = computed(() => Math.max(...(this.candles() ?? []).map((c) => c.high), -Infinity) || 0);

  readonly lastDate = computed(() => {
    const c = this.last();
    if (!c) return '';
    return new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  protected readonly signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

  toggleWatchlist(): void {
    this.toggle.emit(!this.inWatchlist());
  }
}
