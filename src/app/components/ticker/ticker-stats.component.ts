import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FundamentalsDoc } from '../../models/instrument.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';

/**
 * Key stats from OVERVIEW + earnings history (actual vs estimate,
 * surprise %) — beat/miss is one of the highest-signal views for a
 * retail user.
 */
@Component({
  selector: 'pp-ticker-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent, DatePipe],
  template: `
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <pp-widget-card title="Key Stats" [state]="statsState()" info="From the company overview, refreshed on demand.">
        @if (fundamentals()?.overview; as o) {
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div><dt class="text-slate-400">Market Cap</dt><dd class="tabular-nums font-semibold">{{ fmtNum(o.marketCap) }}</dd></div>
            <div><dt class="text-slate-400">P/E</dt><dd class="tabular-nums font-semibold">{{ fmtNum(o.peRatio) }}</dd></div>
            <div><dt class="text-slate-400">EPS</dt><dd class="tabular-nums font-semibold">{{ fmtNum(o.eps) }}</dd></div>
            <div><dt class="text-slate-400">Div Yield</dt><dd class="tabular-nums font-semibold">{{ o.dividendYield !== null ? o.dividendYield + '%' : '—' }}</dd></div>
            <div><dt class="text-slate-400">Beta</dt><dd class="tabular-nums font-semibold">{{ fmtNum(o.beta) }}</dd></div>
            <div><dt class="text-slate-400">52w Range</dt>
              <dd class="tabular-nums font-semibold">{{ fmtNum(o.week52Low) }} – {{ fmtNum(o.week52High) }}</dd></div>
            <div class="col-span-2"><dt class="text-slate-400">Sector / Industry</dt>
              <dd class="font-medium">{{ o.sector || '—' }}{{ o.industry ? ' · ' + o.industry : '' }}</dd></div>
            @if (o.description) {
              <p class="col-span-2 mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{{ o.description }}</p>
            }
          </dl>
        }
      </pp-widget-card>

      <pp-widget-card title="Earnings History" [state]="earningsState()" info="Actual vs consensus estimate per quarter.">
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">
          @for (q of earnings(); track q.fiscalDateEnding) {
            <li class="flex items-center justify-between py-2 text-xs">
              <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ q.fiscalDateEnding | date:'MMM y' }}</span>
              <span class="tabular-nums">est {{ q.estimate ?? '—' }} · act <strong>{{ q.reported ?? '—' }}</strong></span>
              <span class="w-16 text-right tabular-nums font-bold"
                    [class.text-cyan-700]="(q.surprisePercent ?? 0) > 0" [class.dark:text-cyan-400]="(q.surprisePercent ?? 0) > 0"
                    [class.text-orange-600]="(q.surprisePercent ?? 0) < 0" [class.dark:text-orange-400]="(q.surprisePercent ?? 0) < 0">
                {{ surpriseLabel(q.surprisePercent) }}
              </span>
            </li>
          } @empty {
            <li class="py-3 text-center text-[11px] text-slate-400">No earnings history loaded.</li>
          }
        </ul>
      </pp-widget-card>
    </div>
  `,
})
export class TickerStatsComponent {
  readonly fundamentals = input<FundamentalsDoc | null>(null);

  readonly earnings = computed(() => this.fundamentals()?.earnings ?? []);
  readonly hasOverview = computed(() => !!this.fundamentals()?.overview);

  readonly statsState = computed(() => (this.hasOverview() ? ('loaded' as const) : ('empty' as const)));
  readonly earningsState = computed(() => (this.earnings().length > 0 ? ('loaded' as const) : ('empty' as const)));

  fmtNum(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—';
    return v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  surpriseLabel(v: number | null): string {
    if (v === null || !Number.isFinite(v)) return '';
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(1)}%`;
  }
}
