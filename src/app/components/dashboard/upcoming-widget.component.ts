import { Component, computed, input } from '@angular/core';
import { EarningsEvent, IpoEvent } from '../../models/instrument.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { pickUpcoming } from '../../shared/dashboard.util';

/**
 * Upcoming — next 5 earnings + next 3 IPOs from the cached calendars.
 */
@Component({
  selector: 'pp-upcoming-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <pp-widget-card
      title="Upcoming"
      [state]="state()"
      info="Next earnings reports and IPOs from calendars refreshed weekly."
      emptyMessage="Calendars refresh weekly — events appear after the first fetch.">
      <h3 class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Earnings</h3>
      <ul class="mb-3 divide-y divide-slate-100 dark:divide-slate-800">
        @for (e of upcoming().earnings; track e.symbol + e.reportDate) {
          <li class="flex items-center justify-between py-1.5 text-xs">
            <span class="font-semibold text-slate-700 dark:text-slate-300">{{ e.symbol }}</span>
            <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ e.name }}</span>
            <time class="tabular-nums text-slate-500 dark:text-slate-400">{{ e.reportDate }}</time>
          </li>
        } @empty {
          <li class="py-1 text-center text-[11px] text-slate-400">No earnings loaded.</li>
        }
      </ul>

      <h3 class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">IPOs</h3>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        @for (i of upcoming().ipos; track i.symbol + i.ipoDate) {
          <li class="flex items-center justify-between py-1.5 text-xs">
            <span class="font-semibold text-slate-700 dark:text-slate-300">{{ i.symbol }}</span>
            <span class="text-[11px] text-slate-500 dark:text-slate-400">{{ i.name }}</span>
            <time class="tabular-nums text-slate-500 dark:text-slate-400">{{ i.ipoDate }}</time>
          </li>
        } @empty {
          <li class="py-1 text-center text-[11px] text-slate-400">No IPOs loaded.</li>
        }
      </ul>
    </pp-widget-card>
  `,
})
export class UpcomingWidgetComponent {
  readonly earnings = input<EarningsEvent[]>([]);
  readonly ipos = input<IpoEvent[]>([]);
  readonly loading = input(false);

  readonly upcoming = computed(() => pickUpcoming(this.earnings(), this.ipos()));

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    const any = this.upcoming().earnings.length > 0 || this.upcoming().ipos.length > 0;
    return any ? ('loaded' as const) : ('empty' as const);
  });
}
