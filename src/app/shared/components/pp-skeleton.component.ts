/**
 * pp-skeleton — skeleton loading placeholder.
 *
 * Renders animated placeholder blocks while data loads.
 * Supports 'line', 'rect', and 'circle' shapes.
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'pp-skeleton',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (shape) {
      @case ('line') {
        <div
          class="skeleton skeleton-line"
          [style.width]="width"
          [style.height]="height || '14px'"
        ></div>
      }
      @case ('circle') {
        <div
          class="skeleton skeleton-circle"
          [style.width]="width || '40px'"
          [style.height]="width || '40px'"
        ></div>
      }
      @default {
        <div
          class="skeleton skeleton-rect"
          [style.width]="width || '100%'"
          [style.height]="height || '80px'"
        ></div>
      }
    }
  `,
  styles: [`
    .skeleton {
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 6px;
    }
    :host-context(.dark-mode) .skeleton {
      background: linear-gradient(90deg, #334155 25%, #475569 50%, #334155 75%);
      background-size: 200% 100%;
    }
    .skeleton-line {
      border-radius: 4px;
    }
    .skeleton-circle {
      border-radius: 50%;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class PpSkeletonComponent {
  @Input() shape: 'line' | 'rect' | 'circle' = 'rect';
  @Input() width = '';
  @Input() height = '';
}
