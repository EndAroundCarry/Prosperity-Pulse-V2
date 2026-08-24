import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { Candle } from '../../models/instrument.model';
import { MarketDataService } from '../../services/market-data.service';
import { FetchQueueService } from '../../services/fetch-queue.service';
import { TickerHeaderComponent } from './ticker-header.component';
import { TickerStatsComponent } from './ticker-stats.component';
import { PriceChartComponent } from '../../shared/charts/price-chart.component';
import { NewsRailWidgetComponent } from '../dashboard/news-rail-widget.component';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';

/**
 * /ticker/:symbol (Phase 5). Renders immediately with whatever is cached —
 * company name, any related news — and enqueues an on-demand fetch when
 * price data is missing. No fake spinners; the page says what's queued.
 */
@Component({
  selector: 'pp-ticker-page',
  standalone: true,
  imports: [TickerHeaderComponent, TickerStatsComponent, PriceChartComponent, NewsRailWidgetComponent, WidgetCardComponent],
  template: `
    <div class="mx-auto max-w-7xl space-y-4 p-4">
      <a routerLink="/" class="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline">← Back to dashboard</a>

      @if (symbol()) {
        <pp-ticker-header
          [symbol]="symbol()"
          [candles]="candles()"
          [fundamentals]="fundamentals()"
          [inWatchlist]="inWatchlist()"
          (toggle)="onToggleWatchlist()" />

        <pp-widget-card
          title="Price Chart"
          [state]="chartState()"
          info="End-of-day candlesticks with volume. Drag the bottom slider to pan."
          emptyMessage="No cached candles yet — request queued.">
          <pp-price-chart class="block" [candles]="candles() ?? []" />
        </pp-widget-card>

        <pp-ticker-stats [fundamentals]="fundamentals()" />

        <pp-news-rail-widget
          title="Related News"
          [articles]="relatedNews()"
          emptyMessage="No recent articles mention this ticker." />
      }
    </div>
  `,
})
export class TickerPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly marketData = inject(MarketDataService);
  private readonly fetchQueue = inject(FetchQueueService);

  /** Route param as a signal so in-place navigation re-reads everything. */
  readonly symbol = toSignal(
    this.route.paramMap.pipe(map((p) => (p.get('symbol') ?? '').trim().toUpperCase())),
    { initialValue: '' }
  );

  private readonly series = toSignal(
    this.route.paramMap.pipe(
      map((p) => (p.get('symbol') ?? '').trim().toUpperCase()),
      switchMap((sym) => this.marketData.getSeries(sym))
    ),
    { initialValue: null }
  );

  readonly candles = computed<Candle[] | null>(() => this.series());

  readonly fundamentals = toSignal(
    this.route.paramMap.pipe(
      map((p) => (p.get('symbol') ?? '').trim().toUpperCase()),
      switchMap((sym) => this.marketData.getFundamentals(sym))
    ),
    { initialValue: null }
  );

  readonly relatedNews = toSignal(
    this.route.paramMap.pipe(
      map((p) => (p.get('symbol') ?? '').trim().toUpperCase()),
      switchMap((sym) => this.marketData.getRelatedNews(sym))
    ),
    { initialValue: [] }
  );

  readonly inWatchlist = signal(false);

  readonly chartState = computed(() => {
    const cs = this.candles();
    return cs && cs.length > 0 ? ('loaded' as const) : ('empty' as const);
  });

  constructor() {
    // Enqueue the on-demand fetch when there is no cached price data.
    effect(() => {
      const sym = this.symbol();
      const candles = this.series();
      if (!sym) return;
      if (!candles || candles.length === 0) {
        void this.fetchQueue.enqueue(sym).catch(() => undefined);
      }
    });
  }

  onToggleWatchlist(): void {
    const sym = this.symbol();
    if (!sym) return;
    this.inWatchlist.update((v) => !v);
    // Guest flow per plan: localStorage until Phase 6 adds Firestore sync.
    try {
      const key = 'pp.watchlist';
      const raw = localStorage.getItem(key);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const next = this.inWatchlist()
        ? [...new Set([...list, sym])]
        : list.filter((s) => s !== sym);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }
}
