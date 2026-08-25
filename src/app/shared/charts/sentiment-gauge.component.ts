import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { provideEchartsCore, NgxEchartsDirective } from 'ngx-echarts';
import { ThemeService } from '../../core/theme.service';

/**
 * pp-sentiment-gauge — aggregate news sentiment on a -1..1 gauge.
 */
@Component({
  selector: 'pp-sentiment-gauge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts: () => import('./echarts-core') })],
  template: `<div echarts [options]="options()" [theme]="themeService.mode()" role="img" [attr.aria-label]="'News sentiment gauge, score ' + score().toFixed(2) + ' out of 1'" class="block w-full h-[220px]"></div>`,
})
export class SentimentGaugeComponent {
  readonly score = input<number>(0); // -1..1
  readonly themeService = inject(ThemeService);

  readonly options = computed(() => {
    const s = this.score();
    const up = cssVar('--pp-chart-up');
    const down = cssVar('--pp-chart-down');
    const axisColor = cssVar('--pp-chart-axis');

    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          min: -1,
          max: 1,
          startAngle: 210,
          endAngle: -30,
          splitNumber: 4,
          axisLine: { lineStyle: { width: 14, color: [[0.5, down], [1, up]] } },
          pointer: { itemStyle: { color: axisColor }, length: '60%', width: 4 },
          axisTick: { distance: -14, lineStyle: { color: axisColor } },
          splitLine: { distance: -18, length: 8, lineStyle: { color: axisColor } },
          axisLabel: { color: axisColor, distance: 24, formatter: (v: number) => v.toFixed(1) },
          title: { offsetCenter: [0, '45%'], color: axisColor, fontSize: 12 },
          detail: {
            valueAnimation: true,
            formatter: (v: number) => v.toFixed(2),
            color: axisColor,
            fontSize: 20,
            offsetCenter: [0, '25%'],
          },
          data: [{ value: s, name: 'Sentiment' }],
        },
      ],
    };
  });
}

function cssVar(name: string): string {
  if (typeof document === 'undefined') return '#64748b';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#64748b';
}
