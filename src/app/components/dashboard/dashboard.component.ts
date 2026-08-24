import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MarketDataService } from '../../services/market-data.service';
import { asOfLabel, daysStale } from '../../shared/dashboard.util';
import { MarketStatusStripComponent } from './market-status-strip.component';
import { IndexRowWidgetComponent } from './index-row-widget.component';
import { SectorHeatmapWidgetComponent } from './sector-heatmap-widget.component';
import { MoversWidgetComponent } from './movers-widget.component';
import { CrossAssetWidgetComponent } from './cross-asset-widget.component';
import { RatesWidgetComponent } from './rates-widget.component';
import { MacroPulseWidgetComponent } from './macro-pulse-widget.component';
import { SentimentWidgetComponent } from './sentiment-widget.component';
import { NewsRailWidgetComponent } from './news-rail-widget.component';
import { UpcomingWidgetComponent } from './upcoming-widget.component';

/**
 * Market dashboard at `/` (Phase 4). Composes standalone widgets, most-scanned
 * information first. A full render is ~4 Firestore reads via MarketDataService.
 */
@Component({
  selector: 'pp-dashboard',
  standalone: true,
  imports: [
    MarketStatusStripComponent,
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

      <pp-index-row-widget [quotes]="quotes()" [loading]="loading()" />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <pp-sector-heatmap-widget [quotes]="quotes()" [loading]="loading()" />
        <pp-movers-widget
          [gainers]="movers()?.gainers ?? []"
          [losers]="movers()?.losers ?? []"
          [mostActive]="movers()?.mostActive ?? []"
          [updatedAt]="movers()?.updatedAt ?? ''"
          [loading]="loadingMovers()" />
      </div>

      <pp-cross-asset-widget [quotes]="quotes()" [loading]="loading()" />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <pp-rates-widget [tenYear]="treasury10y()" [twoYear]="treasury2y()" />
        <pp-macro-pulse-widget
          [cpi]="cpi()"
          [unemployment]="unemployment()"
          [fedFunds]="fedFunds()"
          [gdp]="gdp()"
          [retailSales]="retailSales()" />
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <pp-sentiment-widget [articles]="news()" />
        <pp-news-rail-widget [articles]="news()" />
      </div>

      <pp-upcoming-widget
        [earnings]="earnings()?.events ?? []"
        [ipos]="ipos()?.events ?? []" />
    </div>
  `,
})
export class DashboardComponent {
  private readonly marketData = inject(MarketDataService);

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
