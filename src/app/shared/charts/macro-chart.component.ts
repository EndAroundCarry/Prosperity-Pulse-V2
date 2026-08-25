import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { provideEchartsCore, NgxEchartsDirective } from 'ngx-echarts';
import { ThemeService } from '../../core/theme.service';

/**
 * pp-macro-chart — line chart for CPI / unemployment / yields.
 * Reads the chart palette from CSS custom properties so it follows the
 * theme without re-rendering on toggle (ECharts picks up the new colors
 * from the DOM on the next render).
 */
@Component({
  selector: 'pp-macro-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts: () => import('./echarts-core') })],
  template: `<div echarts [options]="options()" [theme]="themeService.mode()" role="img" [attr.aria-label]="title() ? title() + ' line chart with ' + points().length + ' data points' : 'Macro indicator line chart'" class="block w-full h-full"></div>`,
})
export class MacroChartComponent {
  readonly title = input('');
  readonly points = input<{ date: string; value: number }[]>([]);
  readonly unit = input('');
  readonly themeService = inject(ThemeService);

  readonly options = computed(() => {
    const pts = this.points();
    const gridColor = cssVar('--pp-chart-grid');
    const axisColor = cssVar('--pp-chart-axis');
    const primary = cssVar('--pp-chart-primary');

    return {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 16, top: 32, bottom: 32 },
      tooltip: { trigger: 'axis' },
      title: this.title()
        ? { text: this.title(), left: 8, top: 4, textStyle: { color: axisColor, fontSize: 12 } }
        : undefined,
      xAxis: {
        type: 'category',
        data: pts.map((p) => p.date),
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: axisColor },
      },
      yAxis: {
        type: 'value',
        name: this.unit(),
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } },
      },
      series: [
        {
          type: 'line',
          data: pts.map((p) => p.value),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: primary },
          areaStyle: { color: primary, opacity: 0.1 },
        },
      ],
    };
  });
}

function cssVar(name: string): string {
  if (typeof document === 'undefined') return '#64748b';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#64748b';
}
