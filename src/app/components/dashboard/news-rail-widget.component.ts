import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsArticle } from '../../models/news-article.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';

function sentimentBadge(score: number | undefined): { label: string; cls: string } | null {
  if (typeof score !== 'number') return null;
  if (score >= 0.15) return { label: `Bullish ${score.toFixed(2)}`, cls: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' };
  if (score <= -0.15) return { label: `Bearish ${score.toFixed(2)}`, cls: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' };
  return { label: 'Neutral', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
}

/**
 * News rail — top 6 articles with sentiment badges, linking to /news-feed.
 */
@Component({
  selector: 'pp-news-rail-widget',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent, RouterLink],
  template: `
    <pp-widget-card
      [title]="title()"
      [state]="state()"
      emptyMessage="News arrives after the first ingest.">
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        @for (a of articles(); track a.id) {
          <li class="py-2 first:pt-0 last:pb-0">
            <a class="group block" [href]="a.sourceUrl" target="_blank" rel="noopener">
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {{ a.title }}
              </span>
              <span class="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                {{ a.sourceName }}
                @if (badge(a); as b) {
                  <span class="rounded-full px-1.5 py-0.5 font-medium" [class]="b.cls">{{ b.label }}</span>
                }
              </span>
            </a>
          </li>
        } @empty {
          <li class="py-3 text-center text-[11px] text-slate-400">No articles yet.</li>
        }
      </ul>
      <a routerLink="/news-feed" class="mt-3 inline-block text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline">
        View full news feed →
      </a>
    </pp-widget-card>
  `,
})
export class NewsRailWidgetComponent {
  readonly articles = input<NewsArticle[]>([]);
  readonly loading = input(false);
  readonly title = input('Latest News');

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    return this.articles().length > 0 ? ('loaded' as const) : ('empty' as const);
  });

  badge(a: NewsArticle) {
    return sentimentBadge(a.overallSentimentScore);
  }
}
