/**
 * DashboardComponent — the market dashboard at `/`.
 *
 * Replaces the marketing hero with a live at-a-glance portal.
 * Composes 10 widget sections as specified in Phase 4:
 * 1. Market status strip
 * 2. Index row (SPY, QQQ, DIA, IWM)
 * 3. Sector heatmap (11 SPDR sector ETFs)
 * 4. Top movers (gainers/losers/most active tabs)
 * 5. Cross-asset strip (crypto, FX, commodities)
 * 6. Rates & yield curve
 * 7. Macro pulse
 * 8. Market sentiment gauge
 * 9. News rail (top 6 articles)
 * 10. Upcoming (earnings + IPOs)
 */

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';

import {
  MarketDataService,
  DashboardSnapshot,
  MoversDoc,
  INDEX_SYMBOLS,
  CRYPTO_SYMBOLS,
  FX_SYMBOLS,
  COMMODITY_SYMBOLS,
  RATE_SYMBOLS,
  MACRO_INDICATOR_IDS,
  SYMBOL_LABELS,
  SECTOR_ETFS,
  EarningsCalendarDoc,
  IpoCalendarDoc,
} from '../../services/market-data.service';
import { NewsService, NewsFilter } from '../../services/news.service';
import { PpWidgetCardComponent } from '../../shared/components/pp-widget-card.component';
import { PpQuoteTileComponent } from '../../shared/components/pp-quote-tile.component';
import { PpSkeletonComponent } from '../../shared/components/pp-skeleton.component';

import { QuoteSnapshot, Mover, MacroSeries } from '../../models/instrument.model';
import { NewsArticle } from '../../models/news-article.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatTabsModule,
    MatButtonModule,
    PpWidgetCardComponent,
    PpQuoteTileComponent,
    PpSkeletonComponent,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly marketData = inject(MarketDataService);
  private readonly newsService = inject(NewsService);
  private readonly cdr = inject(ChangeDetectorRef);

  private subs: Subscription[] = [];

  // Data
  snapshot: DashboardSnapshot = { asOf: '' };
  movers: MoversDoc | null = null;
  earningsCal: EarningsCalendarDoc | null = null;
  ipoCal: IpoCalendarDoc | null = null;
  macroData: Record<string, MacroSeries | null> = {};
  newsArticles: NewsArticle[] = [];

  // Loading states
  snapshotLoaded = false;
  moversLoaded = false;
  earningsLoaded = false;
  ipoLoaded = false;
  macroLoaded = false;
  newsLoaded = false;

  // Movers tab
  activeMoverTab = 'gainers';

  // Known symbol lists
  readonly indexSymbols = INDEX_SYMBOLS;
  readonly cryptoSymbols = CRYPTO_SYMBOLS;
  readonly fxSymbols = FX_SYMBOLS;
  readonly commoditySymbols = COMMODITY_SYMBOLS;
  readonly rateSymbols = RATE_SYMBOLS;
  readonly sectorEfts = Object.entries(SECTOR_ETFS);
  readonly symbolLabels = SYMBOL_LABELS;

  ngOnInit(): void {
    // 1. Dashboard snapshot (single doc read for all tiles)
    this.subs.push(
      this.marketData.getDashboardSnapshot().subscribe((snap) => {
        this.snapshot = snap;
        this.snapshotLoaded = true;
        this.cdr.markForCheck();
      })
    );

    // 2. Movers
    this.subs.push(
      this.marketData.getMovers().subscribe((m) => {
        this.movers = m;
        this.moversLoaded = true;
        this.cdr.markForCheck();
      })
    );

    // 3. Macro indicators
    for (const id of MACRO_INDICATOR_IDS) {
      this.subs.push(
        this.marketData.getMacroIndicator(id).subscribe((data) => {
          this.macroData[id] = data;
          this.macroLoaded = true;
          this.cdr.markForCheck();
        })
      );
    }

    // 4. Earnings calendar
    this.subs.push(
      this.marketData.getEarningsCalendar().subscribe((cal) => {
        this.earningsCal = cal;
        this.earningsLoaded = true;
        this.cdr.markForCheck();
      })
    );

    // 5. IPO calendar
    this.subs.push(
      this.marketData.getIpoCalendar().subscribe((cal) => {
        this.ipoCal = cal;
        this.ipoLoaded = true;
        this.cdr.markForCheck();
      })
    );

    // 6. News (top 6)
    this.subs.push(
      this.newsService.getArticlesRaw({ searchQuery: '', topics: [] }, 0, 6).subscribe((articles) => {
        this.newsArticles = articles.slice(0, 6);
        this.newsLoaded = true;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  // ── Helpers ──

  getQuote(symbol: string): QuoteSnapshot | null {
    return this.marketData.getQuote(this.snapshot, symbol);
  }

  hasAnyQuote(): boolean {
    return Object.keys(this.snapshot).length > 1; // more than just 'asOf'
  }

  getMarketStatus(): { label: string; open: boolean } {
    const now = new Date();
    const eastern = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const day = eastern.getDay();
    const hours = eastern.getHours();
    const minutes = eastern.getMinutes();
    const time = hours * 60 + minutes;

    // Weekend
    if (day === 0 || day === 6) {
      return { label: 'Closed — Weekend', open: false };
    }
    // Market hours: 9:30 AM - 4:00 PM ET
    if (time >= 570 && time < 960) {
      return { label: 'Open', open: true };
    }
    if (time < 570) {
      return { label: 'Pre-market', open: false };
    }
    return { label: 'After-hours', open: false };
  }

  formatPrice(val: number | undefined): string {
    if (val === undefined || val === null) return '—';
    return val >= 100
      ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : val.toFixed(4);
  }

  formatLargeNumber(val: number): string {
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(1) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    return '$' + val.toFixed(0);
  }

  getLatestMacroPoint(id: string): { value: string; date: string; prior: string } | null {
    const series = this.macroData[id];
    if (!series || !series.points || series.points.length === 0) return null;
    const sorted = [...series.points].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sorted[0];
    const prior = sorted[1];
    return {
      value: latest.value.toFixed(1),
      date: latest.date,
      prior: prior ? prior.value.toFixed(1) : '—',
    };
  }

  getMacroLabel(id: string): string {
    const labels: Record<string, string> = {
      'macro.cpi': 'CPI / Inflation',
      'macro.unemployment': 'Unemployment',
      'macro.fed_funds': 'Fed Funds Rate',
      'macro.gdp': 'Real GDP',
      'macro.retail_sales': 'Retail Sales',
    };
    return labels[id] ?? id;
  }

  getMacroUnit(id: string): string {
    const units: Record<string, string> = {
      'macro.cpi': 'Index',
      'macro.unemployment': '%',
      'macro.fed_funds': '%',
      'macro.gdp': 'Trillions $',
      'macro.retail_sales': 'M $',
    };
    return units[id] ?? '';
  }

  getMacroIcon(id: string): string {
    const icons: Record<string, string> = {
      'macro.cpi': 'price_change',
      'macro.unemployment': 'groups',
      'macro.fed_funds': 'account_balance',
      'macro.gdp': 'trending_up',
      'macro.retail_sales': 'shopping_cart',
    };
    return icons[id] ?? 'analytics';
  }

  getMoversList(): Mover[] {
    if (!this.movers) return [];
    switch (this.activeMoverTab) {
      case 'gainers': return this.movers.gainers ?? [];
      case 'losers': return this.movers.losers ?? [];
      case 'active': return this.movers.mostActive ?? [];
      default: return [];
    }
  }

  formatMoverPercent(val: number): string {
    const sign = val >= 0 ? '+' : '';
    return sign + val.toFixed(2) + '%';
  }

  formatMoverPrice(val: number): string {
    return val.toFixed(2);
  }

  formatVolume(val: number): string {
    if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(0) + 'K';
    return val.toString();
  }

  getYieldSpread(): number | null {
    const y10 = this.getQuote('rate.10y');
    const y2 = this.getQuote('macro.2y_yield');
    if (y10 && y2) {
      return y10.price - y2.price;
    }
    return null;
  }

  isYieldCurveInverted(): boolean {
    const spread = this.getYieldSpread();
    return spread !== null && spread < 0;
  }

  formatDateShort(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  trackBySymbol(_index: number, symbol: string): string {
    return symbol;
  }

  trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  formatMoversDate(): string {
    if (!this.movers?.asOf) return '';
    try {
      return new Date(this.movers.asOf).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return this.movers.asOf;
    }
  }

  formatFetchedDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      return 'Fetched ' + new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  }
}
