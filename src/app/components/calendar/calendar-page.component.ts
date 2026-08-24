import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EarningsEvent, IpoEvent } from '../../models/instrument.model';
import { MarketDataService } from '../../services/market-data.service';
import { WatchlistService } from '../../services/watchlist.service';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';

interface EarningsDay {
  date: string;
  events: EarningsEvent[];
}

/** Group earnings by reportDate, optionally filtered to the watchlist. */
export function groupEarningsByDay(
  events: EarningsEvent[],
  watchlistOnly: boolean,
  watchlist: string[]
): EarningsDay[] {
  const rows = watchlistOnly ? events.filter((e) => watchlist.includes(e.symbol.toUpperCase())) : events;
  const map = new Map<string, EarningsEvent[]>();
  for (const e of rows) {
    if (!e.reportDate) continue;
    const list = map.get(e.reportDate) ?? [];
    list.push(e);
    map.set(e.reportDate, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, evts]) => ({ date, events: evts }));
}

/**
 * /calendar — earnings calendar grouped by day (filterable to the
 * watchlist) plus the IPO calendar. Two API calls per week for months of
 * forward-looking data.
 */
@Component({
  selector: 'pp-calendar-page',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, WidgetCardComponent],
  template: `
    <div class="mx-auto max-w-7xl space-y-4 p-4">
      <h1 class="text-xl font-extrabold text-slate-900 dark:text-slate-50">Calendar</h1>

      <pp-widget-card
        title="Earnings"
        [state]="earningsState()"
        info="Refreshed weekly with a 3-month horizon."
        emptyMessage="Earnings arrive after the first weekly refresh.">
        <label class="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" [(ngModel)]="watchlistOnly" />
          Watchlist only
        </label>
        <div class="space-y-4">
          @for (day of earningsDays(); track day.date) {
            <div>
              <h3 class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {{ day.date | date:'EEEE, MMM d' }}
              </h3>
              <ul class="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-100 dark:border-slate-800">
                @for (e of day.events; track e.symbol + e.fiscalDateEnding) {
                  <li class="flex items-center justify-between px-3 py-2 text-xs">
                    <a [routerLink]="['/ticker', e.symbol]" class="font-bold text-blue-700 dark:text-blue-400 hover:underline">{{ e.symbol }}</a>
                    <span class="flex-1 truncate px-3 text-slate-500 dark:text-slate-400">{{ e.name }}</span>
                    <span class="tabular-nums text-slate-600 dark:text-slate-300">
                      {{ e.estimate !== null ? 'est ' + e.estimate + ' ' + e.currency : 'est n/a' }}
                    </span>
                  </li>
                }
              </ul>
            </div>
          } @empty {
            <p class="py-2 text-center text-[11px] text-slate-400">No upcoming earnings in the horizon.</p>
          }
        </div>
      </pp-widget-card>

      <pp-widget-card
        title="IPOs"
        [state]="ipoState()"
        info="Refreshed weekly with a 3-month horizon."
        emptyMessage="IPOs arrive after the first weekly refresh.">
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (i of ipos(); track i.symbol + i.ipoDate) {
            <li class="flex items-center justify-between py-2 text-xs">
              <span class="font-bold text-slate-800 dark:text-slate-200">{{ i.symbol }}</span>
              <span class="flex-1 truncate px-3 text-slate-500 dark:text-slate-400">{{ i.name }}</span>
              <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ priceRange(i) }}</span>
              <time class="ml-3 tabular-nums text-slate-500 dark:text-slate-400">{{ i.ipoDate | date:'MMM d' }}</time>
            </li>
          } @empty {
            <li class="py-2 text-center text-[11px] text-slate-400">No upcoming IPOs.</li>
          }
        </ul>
      </pp-widget-card>
    </div>
  `,
})
export class CalendarPageComponent {
  private readonly marketData = inject(MarketDataService);
  private readonly watchlist = inject(WatchlistService);

  private readonly earningsDoc = toSignal(this.marketData.getEarningsCalendar(), { initialValue: null });
  private readonly ipoDoc = toSignal(this.marketData.getIpoCalendar(), { initialValue: null });

  readonly watchlistOnly = signal(false);

  readonly earningsDays = computed<EarningsDay[]>(() =>
    groupEarningsByDay(this.earningsDoc()?.events ?? [], this.watchlistOnly(), this.watchlist.symbols())
  );

  readonly ipos = computed<IpoEvent[]>(() => this.ipoDoc()?.events ?? []);

  readonly earningsState = computed(() => {
    const events = this.earningsDoc()?.events ?? [];
    return events.length > 0 ? ('loaded' as const) : ('empty' as const);
  });

  readonly ipoState = computed(() => (this.ipos().length > 0 ? ('loaded' as const) : ('empty' as const)));

  priceRange(i: IpoEvent): string {
    if (i.priceRangeLow === null && i.priceRangeHigh === null) return '';
    if (i.priceRangeLow !== null && i.priceRangeHigh !== null) return `$${i.priceRangeLow}–$${i.priceRangeHigh}`;
    return `$${i.priceRangeLow ?? i.priceRangeHigh}`;
  }
}
