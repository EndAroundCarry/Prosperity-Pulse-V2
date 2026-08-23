/**
 * pp-sparkline — lightweight inline SVG sparkline.
 *
 * The build plan specifies this should NOT be ECharts:
 * "a ~40-line inline-SVG polyline. Dozens render per dashboard;
 * ECharts instances are far too heavy for this and SVG paths
 * are effectively free."
 */

import { Component, Input, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'pp-sparkline',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="viewBox"
      class="sparkline"
      [style.width]="width + 'px'"
      [style.height]="height + 'px'"
      preserveAspectRatio="none"
    >
      <!-- Gradient fill under the line -->
      <defs>
        <linearGradient [id]="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [attr.stop-color]="fillColor" stop-opacity="0.3" />
          <stop offset="100%" [attr.stop-color]="fillColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <!-- Area fill -->
      <polygon
        [attr.points]="areaPoints"
        [attr.fill]="'url(#' + gradientId + ')'"
      />
      <!-- Line -->
      <polyline
        [attr.points]="linePoints"
        fill="none"
        [attr.stroke]="lineColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: [`
    :host {
      display: inline-block;
      line-height: 0;
    }
    .sparkline {
      vertical-align: middle;
    }
  `],
})
export class PpSparklineComponent implements OnChanges {
  @Input() data: number[] = [];
  @Input() width = 80;
  @Input() height = 28;
  @Input() positive = true; // determines color

  linePoints = '';
  areaPoints = '';
  viewBox = '0 0 80 28';

  get lineColor(): string {
    return this.positive ? '#22c55e' : '#ef4444';
  }

  get fillColor(): string {
    return this.positive ? '#22c55e' : '#ef4444';
  }

  get gradientId(): string {
    return 'spark-fill-' + (this.positive ? 'up' : 'down');
  }

  ngOnChanges(): void {
    this.rebuild();
  }

  private rebuild(): void {
    if (!this.data || this.data.length < 2) {
      this.linePoints = '';
      this.areaPoints = '';
      return;
    }

    const vals = this.data;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const padY = 2;
    const h = this.height - padY * 2;
    const w = this.width;

    const points: string[] = [];
    for (let i = 0; i < vals.length; i++) {
      const x = (i / (vals.length - 1)) * w;
      const y = padY + h - ((vals[i] - min) / range) * h;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    this.linePoints = points.join(' ');
    // Area polygon: line + baseline
    this.areaPoints =
      `0,${this.height} ` + points.join(' ') + ` ${w},${this.height}`;
  }
}
