import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MacroSeries } from '../../models/instrument.model';
import { MarketDataService } from '../../services/market-data.service';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { MacroChartComponent } from '../../shared/charts/macro-chart.component';
import { RatesWidgetComponent } from '../dashboard/rates-widget.component';
import { SeoService } from '../../services/seo.service';

interface MacroEntry {
  id: string;
  name: string;
  series: MacroSeries | null;
  /** One-sentence plain-English note. */
  note: string;
}

const INDICATORS: Array<{ id: string; label: string; note: string }> = [
  { id: 'cpi', label: 'CPI (Inflation)', note: 'Rising CPI means prices are climbing faster; the Fed typically responds with higher rates.' },
  { id: 'unemployment', label: 'Unemployment', note: 'A falling rate signals a strong labor market; a sharp rise often precedes recessions.' },
  { id: 'fed-funds-rate', label: 'Fed Funds Rate', note: "The Fed's policy rate — higher rates cool inflation but slow borrowing and growth." },
  { id: 'real-gdp', label: 'Real GDP', note: 'The economy\'s total output, inflation-adjusted. Two consecutive quarters of decline is the classic recession marker.' },
  { id: 'retail-sales', label: 'Retail Sales', note: 'Consumer spending drives most US economic activity — softening sales hint at slower growth.' },
];

function latest(series: MacroSeries | null): { value: number; date: string } | null {
  const pts = [...(series?.points ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return pts.length > 0 ? pts[0] : null;
}

/**
 * /macro — full macro dashboard: each indicator with a chart, latest print
 * vs prior, and a one-sentence plain-English "what this means" note.
 */
@Component({
  selector: 'pp-macro-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent, MacroChartComponent, RatesWidgetComponent],
  template: `
    <div class="mx-auto max-w-7xl space-y-4 p-4">
      <h1 class="text-xl font-extrabold text-slate-900 dark:text-slate-50">Macro Dashboard</h1>

      <pp-rates-widget [tenYear]="byId['treasury-10y']()" [twoYear]="byId['treasury-2y']()" />

      @for (entry of entries(); track entry.id) {
        <pp-widget-card
          [title]="entry.label"
          [state]="stateOf(entry)"
          [asOf]="asOf(entry)"
          [staleDays]="staleDays(entry)"
          info="Monthly data on a weekly refresh cycle.">
          <p class="mb-3 text-xs italic text-slate-500 dark:text-slate-400">{{ entry.note }}</p>
          <div class="flex items-baseline gap-3">
            <span class="text-2xl font-extrabold tabular-nums">{{ formatLatest(entry) }}</span>
            @if (direction(entry) !== 0) {
              <span class="text-xs font-medium"
                    [class.text-cyan-700]="direction(entry) > 0" [class.dark:text-cyan-400]="direction(entry) > 0"
                    [class.text-orange-600]="direction(entry) < 0" [class.dark:text-orange-400]="direction(entry) < 0">
                {{ direction(entry) > 0 ? '▲' : '▼' }} prior {{ priorValue(entry) }}
              </span>
            }
          </div>
          <div class="mt-2 h-48">
            <pp-macro-chart [points]="entry.series?.points ?? []" />
          </div>
        </pp-widget-card>
      }
    </div>
  `,
})
export class MacroPageComponent implements OnInit {
  private readonly marketData = inject(MarketDataService);
  private readonly seoService = inject(SeoService);

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: 'Macro Dashboard — CPI, Unemployment, Fed Funds Rate, GDP & Yields',
      description:
        'Track US macroeconomic indicators at a glance: CPI/inflation, unemployment, the Fed funds rate, GDP, retail sales, and the Treasury yield curve, each with a plain-English explainer.',
      keywords: 'macro dashboard, CPI, inflation, unemployment rate, fed funds rate, GDP, treasury yields, yield curve',
      url: '/macro',
    });
    this.seoService.setBreadcrumbs([{ name: 'Macro Dashboard', url: '/macro' }]);
    this.seoService.setPageStructuredData({
      name: 'US Macroeconomic Indicators',
      description:
        'CPI/inflation, unemployment, the federal funds rate, real GDP, retail sales, and the Treasury yield curve, each with the latest print, the prior print, and a plain-English explanation.',
      url: '/macro',
    });
  }

  readonly byId: Record<string, ReturnType<typeof toSignal<MacroSeries | null>>> = {
    ...Object.fromEntries(INDICATORS.map(({ id }) => [id, toSignal(this.marketData.getMacro(id), { initialValue: null })])),
    'treasury-10y': toSignal(this.marketData.getMacro('treasury-10y'), { initialValue: null }),
    'treasury-2y': toSignal(this.marketData.getMacro('treasury-2y'), { initialValue: null }),
  };

  readonly entries = computed<Array<MacroEntry & { label: string }>>(() =>
    INDICATORS.map(({ id, label, note }) => ({
      id,
      label,
      note,
      series: this.byId[id](),
      name: '',
    }))
  );

  stateOf(entry: MacroEntry): 'loading' | 'loaded' | 'empty' {
    return (entry.series?.points?.length ?? 0) > 0 ? 'loaded' : 'empty';
  }

  asOf(entry: MacroEntry): string {
    const l = latest(entry.series);
    if (!l) return '';
    return new Date(`${l.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  staleDays(entry: MacroEntry): number | null {
    const l = latest(entry.series);
    if (!l) return null;
    return Math.floor((Date.now() - Date.parse(`${l.date}T12:00:00Z`)) / (24 * 60 * 60 * 1000));
  }

  formatLatest(entry: MacroEntry): string {
    const l = latest(entry.series);
    if (!l) return '—';
    return `${l.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${entry.series?.unit ?? ''}`;
  }

  priorValue(entry: MacroEntry): string {
    const pts = [...(entry.series?.points ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    return pts.length > 1 ? String(pts[1].value) : '—';
  }

  direction(entry: MacroEntry): number {
    const pts = [...(entry.series?.points ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    if (pts.length < 2) return 0;
    const delta = pts[0].value - pts[1].value;
    return delta > 0 ? 1 : delta < 0 ? -1 : 0;
  }
}
