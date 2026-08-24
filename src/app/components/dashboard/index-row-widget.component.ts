import { Component, computed, input } from '@angular/core';
import { QuoteSnapshot } from '../../models/instrument.model';
import { QuoteTileComponent } from '../../shared/components/quote-tile.component';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';

const INDEX_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM'];

/**
 * Index row — S&P 500 (SPY), Nasdaq 100 (QQQ), Dow (DIA), Russell 2000 (IWM)
 * as proxy ETFs. INDEX_DATA is premium, so these are ETF proxies, labelled
 * honestly per tile.
 */
@Component({
  selector: 'pp-index-row-widget',
  standalone: true,
  imports: [QuoteTileComponent],
  template: `
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      @for (q of indices(); track q.symbol) {
        <pp-quote-tile [quote]="q" />
      }
    </div>
    @if (!loading() && indices().length === 0) {
      <p class="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
        Index proxies arrive after the first daily refresh.
      </p>
    }
  `,
})
export class IndexRowWidgetComponent {
  readonly quotes = input<QuoteSnapshot[]>([]);
  readonly loading = input(false);

  readonly indices = computed(() =>
    INDEX_SYMBOLS
      .map((s) => this.quotes().find((q) => q.symbol === s))
      .filter((q): q is QuoteSnapshot => !!q)
  );
}
