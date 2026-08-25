import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Mover } from '../../models/instrument.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { formatSigned, directionArrow } from '../../shared/dashboard.util';

type MoversTab = 'gainers' | 'losers' | 'mostActive';

/**
 * Top movers — three tabs (Gainers / Losers / Most Active) from the single
 * TOP_GAINERS_LOSERS call. High information density for one API call.
 */
@Component({
  selector: 'pp-movers-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent],
  template: `
    <pp-widget-card
      title="Top Movers"
      [state]="state()"
      [asOf]="asOfLabel()"
      info="Gainers, losers, and most active US stocks. Refreshed twice daily."
      emptyMessage="Movers arrive after the next scheduler tick.">
      <div class="mb-2 flex gap-1">
        @for (t of tabs; track t.key) {
          <button type="button" (click)="active.set(t.key)"
            class="px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors"
            [class]="active() === t.key
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'">
            {{ t.label }}
          </button>
        }
      </div>

      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        @for (m of rows(); track m.symbol) {
          <li class="flex items-center justify-between py-1.5 text-xs">
            <span class="font-semibold text-slate-700 dark:text-slate-300">{{ m.symbol }}</span>
            <span class="tabular-nums text-slate-600 dark:text-slate-400">{{ m.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</span>
            <span class="w-20 text-right tabular-nums font-medium"
                  [class.text-cyan-700]="m.changePercent > 0" [class.dark:text-cyan-400]="m.changePercent > 0"
                  [class.text-orange-600]="m.changePercent < 0" [class.dark:text-orange-400]="m.changePercent < 0">
              {{ arrow(m.changePercent) }} {{ signed(m.changePercent) }}%
            </span>
          </li>
        } @empty {
          <li class="py-3 text-center text-[11px] text-slate-400">No data in this tab.</li>
        }
      </ul>
    </pp-widget-card>
  `,
})
export class MoversWidgetComponent {
  readonly gainers = input<Mover[]>([]);
  readonly losers = input<Mover[]>([]);
  readonly mostActive = input<Mover[]>([]);
  readonly loading = input(false);
  readonly updatedAt = input<string>('');

  readonly tabs: Array<{ key: MoversTab; label: string }> = [
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers', label: 'Losers' },
    { key: 'mostActive', label: 'Most Active' },
  ];
  readonly active = signal<MoversTab>('gainers');

  readonly rows = computed<Mover[]>(() => {
    switch (this.active()) {
      case 'losers': return this.losers().slice(0, 8);
      case 'mostActive': return this.mostActive().slice(0, 8);
      default: return this.gainers().slice(0, 8);
    }
  });

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    const any =
      this.gainers().length > 0 || this.losers().length > 0 || this.mostActive().length > 0;
    return any ? ('loaded' as const) : ('empty' as const);
  });

  readonly asOfLabel = computed(() => {
    const iso = this.updatedAt();
    return iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  });

  protected readonly signed = (v: number) => formatSigned(v);
  protected readonly arrow = (v: number) => directionArrow(v);
}
