import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { NewsArticle } from '../../models/news-article.model';
import { NewsFilter, NewsService } from '../../services/news.service';
import { NewsDetailDialogComponent } from '../news-detail-dialog/news-detail-dialog.component';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { CommentService } from '../../services/comment.service';
import { SeoService } from '../../services/seo.service';
import { ArticleEngagementStats } from '../../models/comment.model';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-news-feed',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './news-feed.component.html',
})
export class NewsFeedComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLElement>;

  private readonly newsService = inject(NewsService);
  private readonly dialog = inject(MatDialog);
  private readonly userPrefsService = inject(UserPreferencesService);
  private readonly commentService = inject(CommentService);
  private readonly seoService = inject(SeoService);

  private observer: IntersectionObserver | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private statsSub?: Subscription;

  readonly pageSize = 12;
  allTopics: string[] = [];

  articles: NewsArticle[] = [];
  engagementStats: Record<string, ArticleEngagementStats> = {};
  currentPage = 0;
  loading = false;
  hasMore = true;
  private maxArticlesToShow = 100; // Limit total articles shown to prevent memory issues

  searchQuery = '';
  selectedTopics: string[] = []; // Topics selected via UI filter
  private activeFilter: NewsFilter = { searchQuery: '', topics: [] };

  // Topics selected in user profile preferences
  private userPreferredTopics: string[] = [];

  // Track pagination state for Firestore
  private lastPublishedAt: string | null = null;

  ngOnInit(): void {
    this.updateFeedSeo();

    this.newsService.getAllTopics().subscribe((topics) => {
      this.allTopics = topics;
    });

    // Subscribe to user preferences to get selected topics
    this.userPrefsService.getPreferences().subscribe((prefs) => {
      this.userPreferredTopics = prefs.selectedTopics;
    });

    // Subscribe to real-time article engagement stats (likes, dislikes, comments)
    this.statsSub = this.commentService.getAllArticleEngagementStats().subscribe((stats) => {
      this.engagementStats = stats;
      if (!this.hasActiveFilters && this.articles.length > 0) {
        this.articles = this.sortArticles(this.articles);
      }
    });
  }

  private updateFeedSeo(): void {
    if (this.searchQuery.trim()) {
      this.seoService.updateSeo({
        title: `Search: "${this.searchQuery}" Market News`,
        description: `Browse latest news stories, ticker movements, and financial analysis for "${this.searchQuery}" on Prosperity Pulse.`,
        keywords: `${this.searchQuery}, market search, financial stocks, trading insights`,
        url: '/news-feed',
      });
    } else if (this.selectedTopics.length > 0) {
      const topicStr = this.selectedTopics.join(', ');
      this.seoService.updateSeo({
        title: `${topicStr} News & Market Analysis`,
        description: `Explore curated news and sector intelligence in ${topicStr}. Real-time headlines and community analysis on Prosperity Pulse.`,
        keywords: `${topicStr}, sector news, business intelligence, market sectors`,
        url: '/news-feed',
      });
    } else {
      this.seoService.updateSeo({
        title: 'Live Market News Feed & Financial Stories',
        description:
          'Live financial news feed with community sentiment, discussion, and curated market updates across Stock Market, Crypto, Economy, and Banking.',
        keywords:
          'live financial feed, market news stream, stock updates, crypto analysis, breaking market headlines, investor sentiment',
        url: '/news-feed',
      });
    }
  }

  ngAfterViewInit(): void {
    this.loadMore();
    this.setupInfiniteScroll();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.statsSub?.unsubscribe();
  }

  getArticleStats(article: NewsArticle): ArticleEngagementStats {
    const key = this.commentService.getArticleKey(article);
    return (
      this.engagementStats[key] || {
        articleId: key,
        likes: 0,
        dislikes: 0,
        commentCount: 0,
        totalInteractions: 0,
        score: 0,
      }
    );
  }

  private sortArticles(articlesList: NewsArticle[]): NewsArticle[] {
    if (this.hasActiveFilters) {
      return articlesList;
    }

    // When NO filter is active, rank the most interacted with news first (score descending)
    return [...articlesList].sort((a, b) => {
      const statsA = this.getArticleStats(a);
      const statsB = this.getArticleStats(b);

      if (statsB.score !== statsA.score) {
        return statsB.score - statsA.score;
      }

      // Tie-break by publication date (newest first)
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  onSearchInput(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.applyFilter({ searchQuery: this.searchQuery, topics: this.activeFilter.topics });
    }, 300);
  }

  onTopicFilterClosed(): void {
    this.applyFilter({ searchQuery: this.activeFilter.searchQuery, topics: this.selectedTopics });
  }

  openArticle(article: NewsArticle): void {
    this.dialog.open(NewsDetailDialogComponent, {
      data: article,
      maxWidth: '640px',
      width: '95vw',
      panelClass: 'news-detail-dialog',
    });
  }

  truncateSummary(text: string, maxLength = 120): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength).trimEnd() + '…';
  }

  get hasActiveFilters(): boolean {
    return (
      this.activeFilter.searchQuery.trim().length > 0 ||
      this.activeFilter.topics.length > 0
    );
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedTopics = [];
    this.applyFilter({ searchQuery: '', topics: [] });
  }

  removeTopicFilter(topic: string): void {
    this.selectedTopics = this.selectedTopics.filter((t) => t !== topic);
    this.applyFilter({ searchQuery: this.searchQuery, topics: this.selectedTopics });
  }

  getTopicIcon(topic: string): string {
    const iconMap: Record<string, string> = {
      'Finance': 'account_balance',
      'Stock Market': 'trending_up',
      'Cryptocurrency': 'currency_bitcoin',
      'Real Estate': 'apartment',
      'Technology': 'memory',
      'Healthcare': 'local_hospital',
      'Economy': 'query_stats',
      'Banking': 'payments',
      'Energy': 'bolt',
      'Markets': 'show_chart',
      'Business': 'business_center',
    };
    return iconMap[topic] || 'label';
  }

  private setupInfiniteScroll(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          this.loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    this.observer.observe(this.scrollSentinel.nativeElement);
  }

  private applyFilter(filter: NewsFilter): void {
    const normalizedFilter: NewsFilter = {
      searchQuery: filter.searchQuery.trim(),
      topics: [...filter.topics],
    };

    const unchanged =
      normalizedFilter.searchQuery === this.activeFilter.searchQuery &&
      normalizedFilter.topics.length === this.activeFilter.topics.length &&
      normalizedFilter.topics.every((topic) => this.activeFilter.topics.includes(topic));

    if (unchanged) {
      return;
    }

    this.activeFilter = normalizedFilter;
    this.updateFeedSeo();
    this.resetFeed();
    this.loadMore();
  }

  private resetFeed(): void {
    this.articles = [];
    this.currentPage = 0;
    this.hasMore = true;
    this.lastPublishedAt = null;
  }

  private loadMore(): void {
    if (this.loading || !this.hasMore) {
      return;
    }

    // Prevent loading more if we've reached the max articles
    if (this.articles.length >= this.maxArticlesToShow) {
      this.hasMore = false;
      return;
    }

    this.loading = true;

    this.newsService
      .getArticlesRaw(this.activeFilter, this.currentPage, this.pageSize, this.lastPublishedAt)
      .subscribe({
        next: (rawArticles) => {
          // Filter articles locally based on search query and topics
          const filtered = rawArticles.filter((article) => {
            const matchesQuery = article.title
              .toLowerCase()
              .includes(this.activeFilter.searchQuery.toLowerCase());
            const matchesTopics =
              this.activeFilter.topics.length === 0 ||
              this.activeFilter.topics.every((topic) => article.topics.includes(topic));
            return matchesQuery && matchesTopics;
          });

          // If active filters, prioritize user topics, otherwise sort by interaction score
          let reordered: NewsArticle[];
          if (this.hasActiveFilters) {
            const matched = filtered.filter((article) =>
              article.topics.some((t) => this.userPreferredTopics.includes(t))
            );
            const others = filtered.filter(
              (article) => !article.topics.some((t) => this.userPreferredTopics.includes(t))
            );
            reordered = [...matched, ...others];
          } else {
            reordered = this.sortArticles(filtered);
          }

          // Combine and strictly deduplicate all articles using unique article key
          const uniqueMap = new Map<string, NewsArticle>();
          for (const article of [...this.articles, ...reordered]) {
            const key = this.commentService.getArticleKey(article);
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, article);
            }
          }

          const combinedArticles = Array.from(uniqueMap.values());
          const finalArticles = this.hasActiveFilters
            ? combinedArticles
            : this.sortArticles(combinedArticles);

          if (finalArticles.length > this.maxArticlesToShow) {
            this.articles = finalArticles.slice(0, this.maxArticlesToShow);
            this.hasMore = false;
          } else {
            this.articles = finalArticles;
          }

          this.currentPage++;

          // Determine if more data is available based on the number of raw articles fetched
          this.hasMore = rawArticles.length > this.pageSize;

          // Update pagination cursors for the next page
          if (rawArticles.length > 0) {
            const lastRaw = rawArticles[rawArticles.length - 1];
            this.lastPublishedAt = lastRaw.publishedAt ?? null;
          }

          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }
}
