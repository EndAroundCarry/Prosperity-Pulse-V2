import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NewsArticle } from '../../models/news-article.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { SentimentGaugeComponent } from '../../shared/charts/sentiment-gauge.component';
import { SentimentSummary, summarizeSentiment } from '../../shared/dashboard.util';

/**
 * Market sentiment gauge — aggregate overall_sentiment_score across the last
 * 24h of ingested articles plus most-mentioned tickers weighted by
 * relevance_score. Derived from data already being fetched — zero API cost.
 */
@Component({
  selector: 'pp-sentiment-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent, SentimentGaugeComponent],
  template: `
    <pp-widget-card
      title="Market Sentiment"
      [state]="state()"
      info="Average news sentiment over the last 24 hours, and the tickers mentioned most (weighted by relevance)."
      emptyMessage="Sentiment appears once news has been ingested.">
      <div class="flex items-center gap-3">
        <pp-sentiment-gauge class="w-1/2" [score]="summary().averageScore" />
        <div class="flex-1 text-xs">
          <p class="font-semibold"
             [class.text-cyan-700]="summary().averageScore > 0.15" [class.dark:text-cyan-400]="summary().averageScore > 0.15"
             [class.text-orange-600]="summary().averageScore < -0.15" [class.dark:text-orange-400]="summary().averageScore < -0.15">
            {{ summary().label }}
          </p>
          <p class="text-[10px] text-slate-400">across {{ summary().articleCount }} articles (24h)</p>
          @if (summary().topTickers.length > 0) {
            <div class="mt-2 flex flex-wrap gap-1">
              @for (t of summary().topTickers; track t.ticker) {
                <span class="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  {{ t.ticker }}
                </span>
              }
            </div>
          }
        </div>
      </div>
    </pp-widget-card>
  `,
})
export class SentimentWidgetComponent {
  readonly articles = input<NewsArticle[]>([]);
  readonly loading = input(false);

  readonly summary = computed<SentimentSummary>(() => summarizeSentiment(this.articles()));

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    const scored = this.articles().some((a) => typeof a.overallSentimentScore === 'number');
    return scored ? ('loaded' as const) : ('empty' as const);
  });
}
