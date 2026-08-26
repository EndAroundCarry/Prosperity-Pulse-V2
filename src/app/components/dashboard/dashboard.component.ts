import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MarketDataService } from '../../services/market-data.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { SeoService } from '../../services/seo.service';
import { asOfLabel, daysStale } from '../../shared/dashboard.util';
import { MarketStatusStripComponent } from './market-status-strip.component';
import { WatchlistStripComponent } from './watchlist-strip.component';
import { IndexRowWidgetComponent } from './index-row-widget.component';
import { SectorHeatmapWidgetComponent } from './sector-heatmap-widget.component';
import { MoversWidgetComponent } from './movers-widget.component';
import { CrossAssetWidgetComponent } from './cross-asset-widget.component';
import { RatesWidgetComponent } from './rates-widget.component';
import { MacroPulseWidgetComponent } from './macro-pulse-widget.component';
import { SentimentWidgetComponent } from './sentiment-widget.component';
import { NewsRailWidgetComponent } from './news-rail-widget.component';
import { UpcomingWidgetComponent } from './upcoming-widget.component';

/** Widget registry: id → template key. Order/visibility come from prefs. */
const WIDGET_IDS = [
  'index', 'sectors', 'movers', 'cross-asset',
  'rates', 'macro', 'sentiment', 'news', 'upcoming',
] as const;

/**
 * Market dashboard at `/` (Phase 4). Composes standalone widgets, most-scanned
 * information first. Widget visibility and order follow user preferences
 * (Phase 6) — the main lever for the "clutter free" requirement.
 */
@Component({
  selector: 'pp-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MarketStatusStripComponent,
    WatchlistStripComponent,
    IndexRowWidgetComponent,
    SectorHeatmapWidgetComponent,
    MoversWidgetComponent,
    CrossAssetWidgetComponent,
    RatesWidgetComponent,
    MacroPulseWidgetComponent,
    SentimentWidgetComponent,
    NewsRailWidgetComponent,
    UpcomingWidgetComponent,
  ],
  template: `
    <div class="mx-auto max-w-7xl space-y-4 p-4">
      <pp-market-status-strip [dataAsOf]="snapshotAsOfLabel()" />

      <pp-watchlist-strip [quotes]="quotes()" />

      @for (id of visibleWidgets(); track id) {
        @switch (id) {
          @case ('index') {
            <pp-index-row-widget [quotes]="quotes()" [loading]="loading()" />
          }
          @case ('sectors') {
            <pp-sector-heatmap-widget [quotes]="quotes()" [loading]="loading()" />
          }
          @case ('movers') {
            <pp-movers-widget
              [gainers]="movers()?.gainers ?? []"
              [losers]="movers()?.losers ?? []"
              [mostActive]="movers()?.mostActive ?? []"
              [updatedAt]="movers()?.updatedAt ?? ''"
              [loading]="loadingMovers()" />
          }
          @case ('cross-asset') {
            <pp-cross-asset-widget [quotes]="quotes()" [loading]="loading()" />
          }
          @case ('rates') {
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <pp-rates-widget [tenYear]="treasury10y()" [twoYear]="treasury2y()" />
              @if (showWidget('macro')) {
                <pp-macro-pulse-widget
                  [cpi]="cpi()"
                  [unemployment]="unemployment()"
                  [fedFunds]="fedFunds()"
                  [gdp]="gdp()"
                  [retailSales]="retailSales()" />
              }
            </div>
          }
          @case ('sentiment') {
            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              @defer (on viewport) {
                <pp-sentiment-widget [articles]="news()" />
              } @placeholder {
                <div class="h-48 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
              }
              @if (showWidget('news')) {
                <pp-news-rail-widget [articles]="news()" />
              }
            </div>
          }
          @case ('upcoming') {
            @defer (on viewport) {
              <pp-upcoming-widget
                [earnings]="earnings()?.events ?? []"
                [ipos]="ipos()?.events ?? []" />
            } @placeholder {
              <div class="h-40 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
            }
          }
        }
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly marketData = inject(MarketDataService);
  private readonly prefs = inject(UserPreferencesService);
  private readonly seoService = inject(SeoService);

  ngOnInit(): void {
    // The landing page keeps the brand-first default title. Setting SEO here
    // (rather than relying on the one-shot call in AppComponent) is also what
    // resets tags when navigating back from /macro, /ticker, etc.
    this.seoService.updateSeo({
      description:
        'A financial portal at a glance: US index and sector performance, top movers, crypto and FX, treasury yields, macro indicators, and market news with sentiment scoring. End-of-day market data.',
      keywords:
        'market dashboard, stock market today, sector performance, top gainers and losers, treasury yields, yield curve, CPI inflation, market sentiment, financial news',
      url: '/',
    });
    this.seoService.setPageStructuredData({
      name: 'Market Dashboard',
      description:
        'US indices, sector heatmap, top movers, cross-asset prices, treasury yields, macro indicators, and news sentiment in a single view.',
      url: '/',
      type: 'CollectionPage',
    });
    // Home is the breadcrumb root — drop any trail left by a previous route.
    this.seoService.clearBreadcrumbs();
  }

  private readonly snapshot = toSignal(this.marketData.getDashboardSnapshot(), { initialValue: null });
  private readonly moversDoc = toSignal(this.marketData.getMovers(), { initialValue: null });
  private readonly earningsDoc = toSignal(this.marketData.getEarningsCalendar(), { initialValue: null });
  private readonly ipoDoc = toSignal(this.marketData.getIpoCalendar(), { initialValue: null });
  readonly news = toSignal(this.marketData.getTopNews(6), { initialValue: [] });

  readonly quotes = () => this.snapshot()?.quotes ?? [];
  readonly movers = () => this.moversDoc();
  readonly earnings = () => this.earningsDoc();
  readonly ipos = () => this.ipoDoc();
  readonly loading = () => this.snapshot() === null;
  readonly loadingMovers = () => false; // docData emits null when empty; widgets show empty state

  readonly treasury10y = toSignal(this.marketData.getMacro('treasury-10y'), { initialValue: null });
  readonly treasury2y = toSignal(this.marketData.getMacro('treasury-2y'), { initialValue: null });
  readonly cpi = toSignal(this.marketData.getMacro('cpi'), { initialValue: null });
  readonly unemployment = toSignal(this.marketData.getMacro('unemployment'), { initialValue: null });
  readonly fedFunds = toSignal(this.marketData.getMacro('fed-funds-rate'), { initialValue: null });
  readonly gdp = toSignal(this.marketData.getMacro('real-gdp'), { initialValue: null });
  readonly retailSales = toSignal(this.marketData.getMacro('retail-sales'), { initialValue: null });

  private readonly preferences = toSignal(this.prefs.preferences$, { initialValue: this.prefs.getPreferencesValue() });

  showWidget(id: string): boolean {
    return !this.preferences().hiddenWidgets.includes(id);
  }

  /** Default order with user ordering applied; paired widgets collapse together. */
  readonly visibleWidgets = computed<string[]>(() => {
    const p = this.preferences();
    const order = [...p.widgetOrder.filter((id) => (WIDGET_IDS as readonly string[]).includes(id))];
    for (const id of WIDGET_IDS) {
      if (!order.includes(id)) order.push(id);
    }
    return order.filter((id) => this.showWidget(id));
  });

  readonly snapshotAsOfLabel = (): string => {
    const updated = this.snapshot()?.updatedAt;
    if (!updated) {
      // Fall back to the newest per-tile close date in the snapshot.
      const dates = [...this.quotes()].map((q) => q.asOf).sort();
      const newest = dates[dates.length - 1];
      return newest ? asOfLabel(newest) : '';
    }
    const days = daysStale(updated);
    return Number.isFinite(days) ? `${asOfLabel(updated)}${days > 0 ? ` (${days}d ago)` : ''}` : '';
  };
}
