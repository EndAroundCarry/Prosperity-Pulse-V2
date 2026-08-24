import { Component, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SymbolUniverseService, SymbolEntry } from '../../services/symbol-universe.service';

/**
 * Ctrl/Cmd+K command palette — instant local autocomplete over the cached
 * symbol universe; Enter navigates to /ticker/:symbol.
 */
@Component({
  selector: 'pp-command-palette',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[12vh]"
        (click)="close()">
        <div
          class="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          (click)="$event.stopPropagation()">
          <input
            type="text"
            class="w-full px-4 py-3 text-sm bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            placeholder="Search symbol or company…"
            [ngModel]="term()"
            (ngModelChange)="onTerm($event)"
            #searchInput />
          <ul class="max-h-72 overflow-y-auto border-t border-slate-100 dark:border-slate-800">
            @for (r of results(); track r.symbol) {
              <li>
                <button type="button"
                  class="w-full text-left px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  (click)="go(r)">
                  <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ r.symbol }}</span>
                  <span class="ml-2 text-xs text-slate-500 dark:text-slate-400">{{ r.name }}</span>
                  @if (r.exchange) {
                    <span class="ml-auto float-right text-[10px] text-slate-400">{{ r.exchange }}</span>
                  }
                </button>
              </li>
            } @empty {
              @if (term().length > 0) {
                <li class="px-4 py-3 text-xs text-slate-400">No matches in the cached universe.</li>
              }
            }
          </ul>
          <div class="border-t border-slate-100 dark:border-slate-800 px-4 py-1.5 text-[10px] text-slate-400">
            ↑↓ browse · Enter open · Esc close
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandPaletteComponent {
  private readonly universe = inject(SymbolUniverseService);
  private readonly router = inject(Router);

  readonly open = signal(false);
  readonly term = signal('');
  readonly results = signal<SymbolEntry[]>([]);

  private searchSeq = 0;

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.toggle();
    } else if (e.key === 'Escape' && this.open()) {
      this.close();
    }
  }

  toggle(): void {
    this.open() ? this.close() : this.open.set(true);
  }

  openPalette(): void {
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.term.set('');
    this.results.set([]);
  }

  onTerm(value: string): void {
    this.term.set(value);
    const seq = ++this.searchSeq;
    this.universe.search(value).subscribe((rows) => {
      if (seq === this.searchSeq) this.results.set(rows);
    });
  }

  go(entry: SymbolEntry): void {
    this.close();
    void this.router.navigate(['/ticker', entry.symbol]);
  }
}
