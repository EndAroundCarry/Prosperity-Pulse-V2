import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { computeMarketStatus } from '../../shared/market-hours.util';

/**
 * Market status strip — open/closed + next open/close countdown, computed
 * client-side from US market hours + static holiday list, plus the global
 * "Data as of · end-of-day" freshness badge.
 */
@Component({
  selector: 'pp-market-status-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-xs
                border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
      <span class="inline-flex items-center gap-1.5 font-semibold"
            [class.text-cyan-700]="isOpen()" [class.dark:text-cyan-400]="isOpen()"
            [class.text-slate-500]="!isOpen()">
        <span class="w-2 h-2 rounded-full" [class.bg-emerald-500]="isOpen()" [class.bg-slate-400]="!isOpen()"></span>
        {{ isOpen() ? 'Market Open' : 'Market Closed' }}
      </span>

      <span class="text-slate-500 dark:text-slate-400">
        {{ isOpen() ? 'Closes' : 'Opens' }} {{ countdownLabel() }}
      </span>

      @if (dataAsOf()) {
        <span class="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1
                     text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Data as of {{ dataAsOf() }} · end-of-day
        </span>
      }
    </div>
  `,
})
export class MarketStatusStripComponent {
  readonly dataAsOf = input<string>('');

  readonly status = computed(() => computeMarketStatus(new Date()));
  readonly isOpen = computed(() => this.status().isOpen);

  readonly countdownLabel = computed(() => {
    const target = Date.parse(this.status().nextTransitionAt);
    const ms = Math.max(target - Date.now(), 0);
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days === 1 ? '' : 's'}`;
    }
    return `in ${hours}h ${minutes}m`;
  });
}
