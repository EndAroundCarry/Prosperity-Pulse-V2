import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Inline-SVG sparkline — deliberately NOT ECharts. Dozens render per
 * dashboard; ECharts instances are far too heavy for this and SVG paths
 * are effectively free.
 */
@Component({
  selector: 'pp-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length > 1) {
    <svg [attr.viewBox]="viewBox()" [attr.aria-label]="ariaLabel()" role="img" class="block w-full h-full">
      <polyline
        [attr.points]="polyline()"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    }
  `,
})
export class SparklineComponent {
  readonly points = input<number[]>([]);
  readonly width = input(100);
  readonly height = input(32);
  readonly strokeColor = input<string>();

  private readonly min = computed(() => Math.min(...this.points()));
  private readonly max = computed(() => Math.max(...this.points()));

  readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height()}`);

  readonly polyline = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';
    const range = this.max() - this.min() || 1;
    const step = this.width() / (pts.length - 1);
    return pts
      .map((v, i) => {
        const x = i * step;
        const y = this.height() - ((v - this.min()) / range) * this.height();
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  });

  readonly ariaLabel = computed(() =>
    `Trend: ${this.points().join(', ')}`
  );
}
