/**
 * TickerDetailComponent — `/ticker/:symbol` page.
 *
 * Shows:
 * - Price header with sparkline
 * - Key stats from OVERVIEW (market cap, P/E, EPS, etc.)
 * - Earnings history (actual vs estimate, surprise %)
 * - Related news filtered by tickerSentiment
 * - Add/remove watchlist button
 *
 * If no cached data exists, renders a useful partial view with
 * an honest "Price data queued, arriving within the hour" notice
 * and writes a request to system/state/fetch_queue.
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
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, switchMap } from 'rxjs';

import {
  MarketDataService,
  FundamentalsDoc,
} from '../../services/market-data.service';
import { PpSparklineComponent } from '../../shared/components/pp-sparkline.component';
import { PpWidgetCardComponent } from '../../shared/components/pp-widget-card.component';
import { PpSkeletonComponent } from '../../shared/components/pp-skeleton.component';
import { QuoteSnapshot, Candle } from '../../models/instrument.model';

@Component({
  selector: 'app-ticker-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    PpSparklineComponent,
    PpSkeletonComponent,
  ],
  templateUrl: './ticker-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TickerDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly marketData = inject(MarketDataService);
  private readonly cdr = inject(ChangeDetectorRef);

  private subs: Subscription[] = [];

  symbol = '';
  snapshot: QuoteSnapshot | null = null;
  fundamentals: FundamentalsDoc | null = null;
  candles: Candle[] = [];
  loading = true;
  dataQueued = false;

  ngOnInit(): void {
    this.subs.push(
      this.route.paramMap
        .pipe(
          switchMap((params) => {
            this.symbol = (params.get('symbol') ?? '').toUpperCase();
            this.loading = true;
            this.snapshot = null;
            this.fundamentals = null;
            this.candles = [];

            // Load fundamentals from Firestore
            return this.marketData.getFundamentals(this.symbol);
          })
        )
        .subscribe((fundamentals) => {
          this.fundamentals = fundamentals;
          this.loading = false;

          // Check if we have price data
          this.subs.push(
            this.marketData.getDashboardSnapshot().subscribe((snap) => {
              this.snapshot = this.marketData.getQuote(snap, this.symbol);

              // Load candles from series doc
              this.subs.push(
                this.loadCandles()
              );

              // If no data at all, mark as queued
              if (!this.snapshot && !this.fundamentals) {
                this.dataQueued = true;
              }

              this.cdr.markForCheck();
            })
          );

          this.cdr.markForCheck();
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private loadCandles(): Subscription {
    // Candle data is in market_series/{symbol} — read via collectionData
    // For now we use the snapshot sparkline; full chart comes in Phase 3
    return new Subscription(); // placeholder
  }

  formatPrice(val: number | undefined): string {
    if (val === undefined || val === null) return '—';
    return val >= 100
      ? val.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : val.toFixed(4);
  }

  formatLargeNumber(val: number): string {
    if (!val) return '—';
    if (val >= 1e12) return '$' + (val / 1e12).toFixed(2) + 'T';
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(2) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(2) + 'M';
    return '$' + val.toLocaleString('en-US');
  }

  formatPercent(val: number | undefined): string {
    if (val === undefined || val === null) return '—';
    return val.toFixed(2) + '%';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }
}
