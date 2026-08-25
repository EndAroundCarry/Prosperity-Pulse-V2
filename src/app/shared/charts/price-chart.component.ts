import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { provideEchartsCore, NgxEchartsDirective } from 'ngx-echarts';
import { ThemeService } from '../../core/theme.service';
import { Candle } from '../../models/instrument.model';

export type PriceRange = '1M' | '3M' | '6M' | '1Y';

/**
 * pp-price-chart — candlestick + volume with a 1M/3M/6M/1Y range toggle
 * and DataZoom.
 */
@Component({
  selector: 'pp-price-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts: () => import('./echarts-core') })],
  template: `
    <div class="flex items-center gap-1 mb-2">
      @for (r of ranges; track r) {
      <button
        type="button"
        (click)="range.set(r)"
        class="px-2 py-0.5 text-xs rounded-full border transition-colors"
        [class]="range() === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-700 dark:text-slate-400'">
        {{ r }}
      </button>
      }
    </div>
    <div echarts [options]="options()" [theme]="themeService.mode()" role="img" [attr.aria-label]="ariaLabel() || ('Price chart, ' + range() + ' range')" class="block w-full h-[320px]"></div>
  `,
})
export class PriceChartComponent {
  readonly candles = input<Candle[]>([]);
  readonly ariaLabel = input<string>('');
  readonly themeService = inject(ThemeService);
  readonly ranges: PriceRange[] = ['1M', '3M', '6M', '1Y'];
  readonly range = signal<PriceRange>('3M');

  private readonly windowed = computed(() => {
    const pts = this.candles();
    const days = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252 }[this.range()];
    return pts.slice(-days);
  });

  readonly options = computed(() => {
    const pts = this.windowed();
    const up = cssVar('--pp-chart-up');
    const down = cssVar('--pp-chart-down');
    const gridColor = cssVar('--pp-chart-grid');
    const axisColor = cssVar('--pp-chart-axis');

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      grid: [
        { left: 56, right: 16, top: 16, height: '58%' },
        { left: 56, right: 16, top: '72%', height: '20%' },
      ],
      xAxis: [
        { type: 'category', data: pts.map((c) => c.date), boundaryGap: true, axisLine: { lineStyle: { color: gridColor } }, axisLabel: { color: axisColor } },
        { type: 'category', gridIndex: 1, data: pts.map((c) => c.date), axisLabel: { show: false }, axisLine: { lineStyle: { color: gridColor } } },
      ],
      yAxis: [
        { scale: true, axisLabel: { color: axisColor }, splitLine: { lineStyle: { color: gridColor } } },
        { gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false } },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 50, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1], bottom: 0, height: 14 },
      ],
      series: [
        {
          name: 'Price',
          type: 'candlestick',
          data: pts.map((c) => [c.open, c.close, c.low, c.high]),
          itemStyle: { color: up, color0: down, borderColor: up, borderColor0: down },
        },
        {
          name: 'Volume',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: pts.map((c, i) => ({
            value: c.volume,
            itemStyle: { color: c.close >= c.open ? up : down, opacity: 0.6 },
          })),
        },
      ],
    };
  });
}

function cssVar(name: string): string {
  if (typeof document === 'undefined') return '#64748b';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#64748b';
}
