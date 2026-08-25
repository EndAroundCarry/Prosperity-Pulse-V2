import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QuoteSnapshot } from '../../models/instrument.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { asOfLabel, directionArrow, formatSigned } from '../../shared/dashboard.util';

const CROSS_ASSET_SYMBOLS = ['BTC', 'ETH', 'EURUSD', 'GLD', 'USO'];

/**
 * Cross-asset strip — Crypto (BTC, ETH) · FX (EUR/USD) · Commodities
 * (Gold via GLD, Oil via USO). Compact, one row.
 */
@Component({
  selector: 'pp-cross-asset-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent],
  template: `
    <pp-widget-card
      title="Cross-Asset"
      [state]="state()"
      [asOf]="asOfLabel()"
      info="Crypto, FX, and commodity proxies. ETH, EUR/USD and commodities rotate on a ~5-day cycle.">
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        @for (q of rows(); track q.symbol) {
          <div class="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
            <span class="block text-[10px] font-medium text-slate-500 dark:text-slate-400">{{ q.name }}</span>
            <div class="flex items-baseline justify-between gap-1">
              <span class="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {{ q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
              </span>
              <span class="text-[10px] tabular-nums font-medium"
                    [class.text-cyan-700]="q.changePercent > 0" [class.dark:text-cyan-400]="q.changePercent > 0"
                    [class.text-orange-600]="q.changePercent < 0" [class.dark:text-orange-400]="q.changePercent < 0"
                    [attr.aria-label]="aria(q)">
                {{ arrow(q.changePercent) }} {{ signed(q.changePercent) }}%
              </span>
            </div>
          </div>
        } @empty {
          <p class="col-span-full py-2 text-center text-[11px] text-slate-400">Awaiting first refresh.</p>
        }
      </div>
    </pp-widget-card>
  `,
})
export class CrossAssetWidgetComponent {
  readonly quotes = input<QuoteSnapshot[]>([]);
  readonly loading = input(false);

  readonly rows = computed(() =>
    CROSS_ASSET_SYMBOLS
      .map((s) => this.quotes().find((q) => q.symbol === s))
      .filter((q): q is QuoteSnapshot => !!q)
  );

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    return this.rows().length > 0 ? ('loaded' as const) : ('empty' as const);
  });

  readonly asOfLabel = computed(() => {
    const dates = this.rows().map((q) => q.asOf).sort();
    const newest = dates[dates.length - 1];
    return newest ? asOfLabel(newest) : '';
  });

  protected readonly signed = (v: number) => formatSigned(v);
  protected readonly arrow = (v: number) => directionArrow(v);

  aria(q: QuoteSnapshot): string {
    return `${q.name}, ${q.price} dollars, ${q.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(q.changePercent).toFixed(1)} percent`;
  }
}
