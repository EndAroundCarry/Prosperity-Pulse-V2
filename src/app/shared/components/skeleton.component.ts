import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Loading skeleton (replaces bare mat-spinners per the plan). */
@Component({
  selector: 'pp-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'tile') {
      <div class="animate-pulse space-y-2" aria-hidden="true">
        <div class="h-3 rounded bg-slate-200 dark:bg-slate-800 w-2/3"></div>
        <div class="h-6 rounded bg-slate-200 dark:bg-slate-800 w-1/2"></div>
        <div class="h-3 rounded bg-slate-200 dark:bg-slate-800 w-full"></div>
      </div>
    } @else if (variant() === 'line') {
      <div class="animate-pulse space-y-1.5" aria-hidden="true">
        @for (i of lines; track i) {
          <div class="h-3 rounded bg-slate-200 dark:bg-slate-800" [class.w-5]="i % 3 === 2"></div>
        }
      </div>
    } @else {
      <div class="animate-pulse h-[220px] rounded-xl bg-slate-200 dark:bg-slate-800" aria-hidden="true"></div>
    }
  `,
})
export class SkeletonComponent {
  readonly variant = input<'tile' | 'line' | 'block'>('block');
  readonly lines = [0, 1, 2, 3];
}
