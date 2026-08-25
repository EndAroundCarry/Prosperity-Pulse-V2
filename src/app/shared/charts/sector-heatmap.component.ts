import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { provideEchartsCore, NgxEchartsDirective } from 'ngx-echarts';
import { ThemeService } from '../../core/theme.service';

export interface SectorTile {
  name: string;
  symbol: string;
  changePercent: number;
}

/**
 * pp-sector-heatmap — treemap sized by nothing (equal tiles), colored by
 * % change on a blue↔orange diverging scale (colorblind-safe; no red/green).
 */
@Component({
  selector: 'pp-sector-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts: () => import('./echarts-core') })],
  template: `<div echarts [options]="options()" [theme]="themeService.mode()" role="img" [attr.aria-label]="ariaLabel()" class="block w-full h-[320px]"></div>`,
})
export class SectorHeatmapComponent {
  readonly tiles = input<SectorTile[]>([]);
  readonly themeService = inject(ThemeService);

  readonly ariaLabel = computed(() =>
    'Sector performance heatmap: ' +
    this.tiles()
      .map((t) => `${t.symbol} ${t.changePercent >= 0 ? 'up' : 'down'} ${Math.abs(t.changePercent).toFixed(2)} percent`)
      .join(', ')
  );

  readonly options = computed(() => {
    const tiles = this.tiles();
    const maxAbs = Math.max(...tiles.map((t) => Math.abs(t.changePercent)), 0.01);

    const colorFor = (v: number): string => {
      if (v >= 0) {
        // Positive → orange (warm).
        const t = Math.min(v / maxAbs, 1);
        return mix('#f59e0b', '#f97316', t);
      }
      // Negative → blue (cool).
      const t = Math.min(-v / maxAbs, 1);
      return mix('#3b82f6', '#1d4ed8', t);
    };

    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (p: { name: string; value: unknown[] }) => {
          const v = p.value;
          const change = typeof v[0] === 'number' ? v[0] : 0;
          return `${p.name}: ${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: { show: true, formatter: '{b}\n{c}%' },
          data: tiles.map((t) => ({
            name: t.symbol,
            value: [t.changePercent, t.name],
            itemStyle: { color: colorFor(t.changePercent) },
          })),
        },
      ],
    };
  });
}

/** Mix two hex colors by t in [0,1]. */
function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
