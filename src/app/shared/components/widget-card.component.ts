import { Component, input } from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/**
 * pp-widget-card — shared frame: title + freshness + info tooltip + content.
 * Every dashboard widget composes this so the four states (loading /
 * loaded / empty / stale) look identical across the page.
 */
@Component({
  selector: 'pp-widget-card',
  standalone: true,
  imports: [SkeletonComponent],
  template: `
    <section class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <header class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-1.5">
          <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ title() }}</h2>
          @if (info()) {
            <span
              class="text-[10px] text-slate-400 cursor-help select-none"
              [title]="info()"
              aria-label="About this widget">ⓘ</span>
          }
        </div>
        @if (asOf()) {
          <time class="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">as of {{ asOf() }}</time>
        }
      </header>

      @switch (state()) {
        @case ('loading') {
          <pp-skeleton [variant]="'block'" />
        }
        @case ('empty') {
          <div class="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
            {{ emptyMessage() }}
          </div>
        }
        @default {
          <ng-content />
        }
      }

      @if (staleDays() !== null && staleDays()! > 0) {
        <footer class="mt-3 text-[10px] text-amber-600 dark:text-amber-500">
          Data from {{ staleDays() }} day{{ staleDays() === 1 ? '' : 's' }} ago · end-of-day
        </footer>
      }
    </section>
  `,
})
export class WidgetCardComponent {
  readonly title = input.required<string>();
  readonly state = input<'loading' | 'loaded' | 'empty'>('loaded');
  readonly asOf = input<string>('');
  readonly info = input<string>('');
  readonly emptyMessage = input<string>('First fetch queued — check back shortly.');
  /** Days since the data was fetched; null/0 = fresh, no banner. */
  readonly staleDays = input<number | null>(null);
}
