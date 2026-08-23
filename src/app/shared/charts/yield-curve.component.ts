import { Component, computed, inject, input } from '@angular/core';
import { provideEchartsCore, NgxEchartsDirective } from 'ngx-echarts';
import { ThemeService } from '../../core/theme.service';

export interface YieldPoint {
  maturity: string;
  yield: number;
}

/**
 * pp-yield-curve — line chart of treasury yields across maturities with an
 * inversion callout when the 10y-2y spread is negative.
 */
@Component({
  selector: 'pp-yield-curve',
  standalone: true,
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts: () => import('./echarts-core') })],
  template: `<div echarts [options]="options()" [theme]="themeService.mode()" class="block w-full h-[240px]"></div>`,
})
export class YieldCurveComponent {
  readonly points = input<YieldPoint[]>([]);
  readonly themeService = inject(ThemeService);

  readonly inverted = computed(() => {
    const pts = this.points();
    const two = pts.find((p) => p.maturity.includes('2y') || p.maturity.includes('2'));
    const ten = pts.find((p) => p.maturity.includes('10y') || p.maturity.includes('10'));
    return !!(two && ten && ten.yield < two.yield);
  });

  readonly options = computed(() => {
    const pts = this.points();
    const primary = cssVar('--pp-chart-primary');
    const gridColor = cssVar('--pp-chart-grid');
    const axisColor = cssVar('--pp-chart-axis');

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      title: this.inverted()
        ? { text: '⚠ Yield curve inverted', left: 8, top: 4, textStyle: { color: cssVar('--pp-chart-down'), fontSize: 12 } }
        : undefined,
      grid: { left: 48, right: 16, top: 32, bottom: 32 },
      xAxis: { type: 'category', data: pts.map((p) => p.maturity), axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: axisColor } },
      yAxis: { type: 'value', name: '%', axisLabel: { color: axisColor }, splitLine: { lineStyle: { color: gridColor } } },
      series: [{ type: 'line', data: pts.map((p) => p.yield), symbol: 'circle', symbolSize: 6, lineStyle: { width: 2, color: primary }, itemStyle: { color: primary } }],
    };
  });
}

function cssVar(name: string): string {
  if (typeof document === 'undefined') return '#64748b';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#64748b';
}
