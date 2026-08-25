import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { QuoteSnapshot } from '../../models/instrument.model';
import { WatchlistService, WATCHLIST_CAP } from '../../services/watchlist.service';
import { directionArrow, formatSigned } from '../../shared/dashboard.util';

/**
 * Watchlist strip pinned to the top of the dashboard; reorderable via CDK
 * drag-drop. Symbols without cached quotes render with a "queued" hint.
 */
@Component({
  selector: 'pp-watchlist-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DragDropModule],
  template: `
    @if (watchlist.symbols().length > 0) {
      <div cdkDropList cdkDropListOrientation="horizontal" (cdkDropListDropped)="drop($event)"
           class="flex gap-2 overflow-x-auto pb-1">
        @for (sym of watchlist.symbols(); track sym) {
          <div cdkDrag
               class="shrink-0 rounded-xl border px-3 py-2 cursor-grab active:cursor-grabbing
                      border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
            <a [routerLink]="['/ticker', sym]" class="block">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ sym }}</span>
              @if (quoteFor(sym); as q) {
                <span class="ml-2 text-xs tabular-nums text-slate-900 dark:text-slate-50">
                  {{ q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
                </span>
                <span class="ml-1 text-[10px] tabular-nums font-medium"
                      [class.text-cyan-700]="q.changePercent > 0" [class.dark:text-cyan-400]="q.changePercent > 0"
                      [class.text-orange-600]="q.changePercent < 0" [class.dark:text-orange-400]="q.changePercent < 0">
                  {{ arrow(q.changePercent) }} {{ signed(q.changePercent) }}%
                </span>
              } @else {
                <span class="ml-2 text-[10px] text-slate-400">queued…</span>
              }
            </a>
          </div>
        }
      </div>
      @if (watchlist.isFull()) {
        <p class="mt-1 text-[10px] text-slate-400">
          Watchlist is at the {{ cap }}-symbol cap — each entry competes for the daily on-demand budget.
        </p>
      }
    }
  `,
})
export class WatchlistStripComponent {
  readonly watchlist = inject(WatchlistService);
  readonly quotes = input<QuoteSnapshot[]>([]);

  readonly cap = WATCHLIST_CAP;

  protected readonly arrow = (v: number) => directionArrow(v);
  protected readonly signed = (v: number) => formatSigned(v);

  quoteFor(sym: string): QuoteSnapshot | undefined {
    return this.quotes().find((q) => q.symbol === sym);
  }

  drop(event: CdkDragDrop<string[]>): void {
    const list = [...this.watchlist.symbols()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    void this.watchlist.reorder(list);
  }
}
