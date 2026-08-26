import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { Candle } from '../../models/instrument.model';
import { MarketDataService } from '../../services/market-data.service';
import { FetchQueueService } from '../../services/fetch-queue.service';
import { WatchlistService } from '../../services/watchlist.service';
import { SeoService, SITE_URL } from '../../services/seo.service';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
          (toggle)="watchlist.toggle(symbol())" />

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
  private readonly seoService = inject(SeoService);
  readonly watchlist = inject(WatchlistService);

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

  readonly inWatchlist = computed(() => this.watchlist.symbols().includes(this.symbol()));

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

    // Per-ticker SEO metadata; picks up the company name once fundamentals load.
    effect(() => {
      const sym = this.symbol();
      if (!sym) return;

      const overview = this.fundamentals()?.overview;
      const name = overview?.name;
      const label = name ? `${name} (${sym})` : sym;
      const hasData = (this.series()?.length ?? 0) > 0;

      // Any of the ~11k listed US symbols resolves to a route here, but only
      // the handful with cached data render anything substantial. Indexing the
      // rest would flood the index with thin, near-identical pages and burn
      // crawl budget, so a ticker only becomes indexable once it has data.
      this.seoService.updateSeo({
        title: `${label} Stock Price, Chart & Key Stats`,
        description: overview?.sector
          ? `${label} — end-of-day price chart, market cap, P/E, EPS, 52-week range, earnings history, and related news. Sector: ${overview.sector}.`
          : `${label} end-of-day price chart, key stats, earnings history, and related news on Prosperity Pulse.`,
        keywords: `${sym}, ${name ?? sym} stock, ${sym} stock price, ${sym} earnings, ${sym} chart`,
        url: `/ticker/${sym}`,
        robots: hasData ? 'index' : 'noindex',
      });

      this.seoService.setBreadcrumbs([{ name: sym, url: `/ticker/${sym}` }]);

      if (hasData) {
        this.seoService.setPageStructuredData({
          name: `${label} Stock Overview`,
          description: `End-of-day price history, key statistics, and earnings for ${label}.`,
          url: `/ticker/${sym}`,
        });
        this.seoService.setStructuredData(
          {
            '@context': 'https://schema.org',
            '@type': 'Corporation',
            name: name || sym,
            tickerSymbol: sym,
            ...(overview?.description ? { description: overview.description } : {}),
            ...(overview?.industry ? { industry: overview.industry } : {}),
            url: `${SITE_URL}/ticker/${sym}`,
          },
          'json-ld-ticker'
        );
      } else {
        this.seoService.clearPageStructuredData();
      }
    });
  }

  onToggleWatchlist(): void {
    this.watchlist.toggle(this.symbol());
  }
}
