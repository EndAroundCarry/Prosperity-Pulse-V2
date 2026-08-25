import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MacroSeries } from '../../models/instrument.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { MacroChartComponent } from '../../shared/charts/macro-chart.component';

interface MacroRow {
  id: string;
  label: string;
  series: MacroSeries | null;
}

const INDICATORS: Array<{ id: string; label: string }> = [
  { id: 'cpi', label: 'CPI (inflation)' },
  { id: 'unemployment', label: 'Unemployment' },
  { id: 'fed-funds-rate', label: 'Fed Funds Rate' },
  { id: 'real-gdp', label: 'Real GDP' },
];

/**
 * Macro pulse — latest CPI, unemployment, fed funds rate, GDP: current
 * value, prior value, direction, and release date. Weekly refresh is more
 * than adequate for monthly data.
 */
@Component({
  selector: 'pp-macro-pulse-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent],
  template: `
    <pp-widget-card
      title="Macro Pulse"
      [state]="state()"
      info="Monthly macro indicators on a weekly refresh cycle."
      emptyMessage="Macro prints arrive as the slow rotation works through them.">
      <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        @for (row of rows(); track row.id) {
          <li class="rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2">
            <span class="block text-[10px] font-medium text-slate-500 dark:text-slate-400">{{ row.label }}</span>
            <div class="flex items-baseline justify-between">
              <span class="text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {{ formatValue(row.series) }}
              </span>
              <span class="text-[10px] tabular-nums font-medium"
                    [class.text-cyan-700]="direction(row) > 0" [class.dark:text-cyan-400]="direction(row) > 0"
                    [class.text-orange-600]="direction(row) < 0" [class.dark:text-orange-400]="direction(row) < 0"
                    [class.text-slate-400]="direction(row) === 0">
                {{ arrowChar(direction(row)) }} {{ priorLabel(row) }}
              </span>
            </div>
            @if (releaseDate(row)) {
              <span class="block text-[9px] text-slate-400">Released {{ releaseDate(row) }}</span>
            }
          </li>
        }
      </ul>
    </pp-widget-card>
  `,
})
export class MacroPulseWidgetComponent {
  readonly cpi = input<MacroSeries | null>(null);
  readonly unemployment = input<MacroSeries | null>(null);
  readonly fedFunds = input<MacroSeries | null>(null);
  readonly gdp = input<MacroSeries | null>(null);
  readonly retailSales = input<MacroSeries | null>(null);
  readonly loading = input(false);

  readonly rows = computed<MacroRow[]>(() => {
    const byId: Record<string, MacroSeries | null> = {
      'cpi': this.cpi(),
      'unemployment': this.unemployment(),
      'fed-funds-rate': this.fedFunds(),
      'real-gdp': this.gdp(),
      'retail-sales': this.retailSales(),
    };
    return INDICATORS
      .map(({ id, label }) => ({ id, label, series: byId[id] ?? null }))
      .concat(
        this.retailSales() ? [{ id: 'retail-sales', label: 'Retail Sales', series: this.retailSales() }] : []
      );
  });

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    const any = this.rows().some((r) => r.series && (r.series.points?.length ?? 0) > 0);
    return any ? ('loaded' as const) : ('empty' as const);
  });

  /** +1 rising, -1 falling, 0 flat/unknown — comparing latest vs prior print. */
  direction(row: MacroRow): number {
    const pts = sortedPoints(row.series);
    if (pts.length < 2) return 0;
    const delta = pts[0].value - pts[1].value;
    return delta > 0 ? 1 : delta < 0 ? -1 : 0;
  }

  priorLabel(row: MacroRow): string {
    const pts = sortedPoints(row.series);
    if (pts.length < 2) return '';
    return `prior ${pts[1].value}`;
  }

  releaseDate(row: MacroRow): string {
    const pts = sortedPoints(row.series);
    return pts[0]?.date ?? '';
  }

  formatValue(series: MacroSeries | null): string {
    const pts = sortedPoints(series);
    if (pts.length === 0) return '—';
    return `${pts[0].value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${series?.unit ?? ''}`;
  }

  arrowChar(d: number): string {
    return d > 0 ? '▲' : d < 0 ? '▼' : '•';
  }
}

function sortedPoints(series: MacroSeries | null): Array<{ date: string; value: number }> {
  return [...(series?.points ?? [])].sort((a, b) => b.date.localeCompare(a.date));
}
