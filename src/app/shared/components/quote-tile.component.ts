import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QuoteSnapshot } from '../../models/instrument.model';
import { SparklineComponent } from '../charts/sparkline.component';
import { asOfLabel, directionArrow, formatSigned } from '../dashboard.util';

/**
 * pp-quote-tile — one instrument: last close, absolute + % change, arrow,
 * sparkline, and its own "as of" (per-tile because Tier B rotates).
 */
@Component({
  selector: 'pp-quote-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SparklineComponent],
  template: `
    <div role="img" class="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4" [attr.aria-label]="ariaLabel()">
      <div class="flex items-baseline justify-between">
        <div>
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">{{ quote().name }}</span>
          @if (quote().proxyFor) {
            <span class="ml-1 text-[9px] uppercase tracking-wide text-slate-400" [title]="'Proxy ETF for ' + quote().proxyFor">ETF</span>
          }
          <span class="block text-[10px] text-slate-400">{{ quote().symbol }}</span>
        </div>
        <span
          class="text-sm font-bold tabular-nums"
          [class.text-cyan-700]="quote().change > 0"
          [class.dark:text-cyan-400]="quote().change > 0"
          [class.text-orange-600]="quote().change < 0"
          [class.dark:text-orange-400]="quote().change < 0"
          [attr.aria-label]="ariaLabel()">
          {{ directionArrow(quote().change) }} {{ formatSigned(quote().change) }}
        </span>
      </div>

      <div class="mt-1 flex items-end justify-between gap-2">
        <span class="text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
          {{ quote().price.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
        </span>
        <pp-sparkline class="w-20 h-7" [points]="quote().sparkline" />
      </div>

      <div class="mt-1 flex items-center justify-between text-[10px]">
        <span
          class="tabular-nums font-medium"
          [class.text-cyan-700]="quote().changePercent > 0"
          [class.dark:text-cyan-400]="quote().changePercent > 0"
          [class.text-orange-600]="quote().changePercent < 0"
          [class.dark:text-orange-400]="quote().changePercent < 0">
          {{ formatSigned(quote().changePercent) }}%
        </span>
        <time class="text-slate-400 dark:text-slate-500">Close, {{ asOfLabel(quote().asOf) }}</time>
      </div>
    </div>
  `,
})
export class QuoteTileComponent {
  readonly quote = input.required<QuoteSnapshot>();

  readonly ariaLabel = computed(() => {
    const q = this.quote();
    const dir = q.change >= 0 ? 'up' : 'down';
    return `${q.name} proxy ${q.symbol}, ${q.price} dollars, ${dir} ${Math.abs(q.changePercent).toFixed(1)} percent, as of ${q.asOf}`;
  });

  protected readonly formatSigned = formatSigned;
  protected readonly directionArrow = directionArrow;
  protected readonly asOfLabel = asOfLabel;
}
