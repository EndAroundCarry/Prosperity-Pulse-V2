import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MacroSeries } from '../../models/instrument.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { YieldCurveComponent, YieldPoint } from '../../shared/charts/yield-curve.component';

/**
 * Rates & yield curve — 10y and 2y treasury yields, the 10y−2y spread, and
 * an inversion flag with a one-line plain-English explanation.
 */
@Component({
  selector: 'pp-rates-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent, YieldCurveComponent],
  template: `
    <pp-widget-card
      title="Rates & Yield Curve"
      [state]="state()"
      [asOf]="asOfLabel()"
      [staleDays]="staleDays()"
      info="US Treasury yields. The 2y is on a weekly rotation; the curve chart uses whichever maturities are loaded."
      emptyMessage="Yields arrive after the first daily refresh.">
      <div class="mb-3 flex items-center gap-4 text-xs">
        @for (r of headline(); track r.label) {
          <span class="tabular-nums text-slate-600 dark:text-slate-300">
            {{ r.label }} <strong class="text-sm">{{ r.value.toFixed(2) }}%</strong>
          </span>
        }
        <span class="tabular-nums font-medium"
              [class.text-cyan-700]="spread() >= 0" [class.dark:text-cyan-400]="spread() >= 0"
              [class.text-orange-600]="spread() < 0" [class.dark:text-orange-400]="spread() < 0">
          Spread {{ spread() >= 0 ? '+' : '' }}{{ spread().toFixed(2) }}%
        </span>
      </div>

      @if (inverted()) {
        <p class="mb-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 px-3 py-1.5 text-[11px] text-orange-700 dark:text-orange-400">
          ⚠ The yield curve is inverted — short-term rates exceed long-term rates,
          which has historically preceded recessions.
        </p>
      }

      <pp-yield-curve [points]="curvePoints()" />
    </pp-widget-card>
  `,
})
export class RatesWidgetComponent {
  readonly tenYear = input<MacroSeries | null>(null);
  readonly twoYear = input<MacroSeries | null>(null);
  readonly loading = input(false);

  readonly latestTen = computed(() => this.latest(this.tenYear()));
  readonly latestTwo = computed(() => this.latest(this.twoYear()));

  readonly spread = computed(() => {
    const ten = this.latestTen();
    const two = this.latestTwo();
    if (ten === null || two === null) return 0;
    return ten - two;
  });

  readonly inverted = computed(() => {
    const ten = this.latestTen();
    const two = this.latestTwo();
    return ten !== null && two !== null && ten < two;
  });

  readonly headline = computed(() => {
    const rows: Array<{ label: string; value: number }> = [];
    const ten = this.latestTen();
    const two = this.latestTwo();
    if (two !== null) rows.push({ label: '2y', value: two });
    if (ten !== null) rows.push({ label: '10y', value: ten });
    return rows;
  });

  readonly curvePoints = computed<YieldPoint[]>(() => {
    const pts: YieldPoint[] = [];
    const two = this.latestTwo();
    const ten = this.latestTen();
    if (two !== null) pts.push({ maturity: '2y', yield: two });
    if (ten !== null) pts.push({ maturity: '10y', yield: ten });
    return pts;
  });

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    return this.headline().length > 0 ? ('loaded' as const) : ('empty' as const);
  });

  readonly asOfLabel = computed(() => {
    for (const s of [this.tenYear(), this.twoYear()]) {
      const last = s?.points?.[0]?.date;
      if (last) return last;
    }
    return '';
  });

  readonly staleDays = computed(() => {
    const dates = [this.tenYear(), this.twoYear()]
      .map((s) => s?.points?.[0]?.date)
      .filter((d): d is string => !!d)
      .sort();
    const newest = dates[dates.length - 1];
    if (!newest) return null;
    return Math.floor((Date.now() - Date.parse(newest)) / (24 * 60 * 60 * 1000));
  });

  private latest(series: MacroSeries | null): number | null {
    // Alpha Vantage macro feeds are newest-first; sort defensively anyway.
    const pts = series?.points ?? [];
    if (pts.length === 0) return null;
    const newest = [...pts].sort((a, b) => b.date.localeCompare(a.date))[0];
    return typeof newest.value === 'number' && Number.isFinite(newest.value) ? newest.value : null;
  }
}
