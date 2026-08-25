import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
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
import {
  NewsArticle,
  TickerSentiment,
} from '../../models/news-article.model';
import {
  BULLISH_THRESHOLD,
  NewsFilter,
  NewsService,
  NewsSortMode,
  SentimentBucket,
  sentimentBucket,
} from '../../services/news.service';
import { NewsDetailDialogComponent } from '../news-detail-dialog/news-detail-dialog.component';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { CommentService } from '../../services/comment.service';
import { SeoService } from '../../services/seo.service';
import { ArticleEngagementStats } from '../../models/comment.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-news-feed',
  standalone: true,
  imports: [
    DatePipe,
    NgOptimizedImage,
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
  private readonly destroyRef = inject(DestroyRef);

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
  selectedTicker = '';
  selectedSentiment: SentimentBucket | '' = '';
  sortMode: NewsSortMode = 'newest';

  readonly sentimentOptions: { value: SentimentBucket | ''; label: string }[] = [
    { value: '', label: 'All sentiments' },
    { value: 'bullish', label: 'Bullish' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'bearish', label: 'Bearish' },
  ];

  readonly sortOptions: { value: NewsSortMode; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'most-relevant', label: 'Most relevant' },
    { value: 'most-bullish', label: 'Most bullish' },
    { value: 'most-bearish', label: 'Most bearish' },
    { value: 'most-discussed', label: 'Most discussed' },
  ];

  private activeFilter: NewsFilter = {
    searchQuery: '',
    topics: [],
    ticker: '',
    sentiment: undefined,
    sort: 'newest',
  };

  // Topics selected in user profile preferences
  private userPreferredTopics: string[] = [];

  // Track pagination state for Firestore
  private lastPublishedAt: string | null = null;

  ngOnInit(): void {
    this.updateFeedSeo();

    this.newsService
      .getAllTopics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((topics) => {
      this.allTopics = topics;
    });

    // Subscribe to user preferences to get selected topics
    this.userPrefsService
      .getPreferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((prefs) => {
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

  getSentimentBadge(article: NewsArticle): {
    label: string;
    score: number | null;
    cls: string;
  } | null {
    const bucket = sentimentBucket(article.overallSentimentScore);
    if (!bucket) return null;
    const base =
      'absolute bottom-2.5 left-3 px-2 py-0.5 text-[10px] font-bold rounded-full backdrop-blur-md shadow-sm flex items-center gap-1 border';
    if (bucket === 'bullish') {
      return {
        label: 'Bullish',
        score: article.overallSentimentScore ?? null,
        cls: `${base} bg-cyan-500/90 text-white border-cyan-300/50`,
      };
    }
    if (bucket === 'bearish') {
      return {
        label: 'Bearish',
        score: article.overallSentimentScore ?? null,
        cls: `${base} bg-orange-500/90 text-white border-orange-300/50`,
      };
    }
    return {
      label: 'Neutral',
      score: article.overallSentimentScore ?? null,
      cls: `${base} bg-slate-600/90 text-white border-slate-400/50`,
    };
  }

  getTopTickers(article: NewsArticle): TickerSentiment[] {
    if (!article.tickerSentiment?.length) return [];
    return [...article.tickerSentiment]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);
  }

  tickerChipCls(sentimentLabel: string): string {
    const normalized = sentimentLabel.toLowerCase();
    if (normalized.includes('bullish')) return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300';
    if (normalized.includes('bearish')) return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }

  private sortArticles(articlesList: NewsArticle[]): NewsArticle[] {
    const list = [...articlesList];
    switch (this.activeFilter.sort) {
      case 'most-bullish':
        return list.sort(
          (a, b) => (b.overallSentimentScore ?? -Infinity) - (a.overallSentimentScore ?? -Infinity)
        );
      case 'most-bearish':
        return list.sort(
          (a, b) => (a.overallSentimentScore ?? Infinity) - (b.overallSentimentScore ?? Infinity)
        );
      case 'most-discussed':
        return list.sort((a, b) => {
          const diff =
            this.getArticleStats(b).commentCount - this.getArticleStats(a).commentCount;
          if (diff !== 0) return diff;
          return this.newestFirst(a, b);
        });
      default:
        return list.sort((a, b) => this.newestFirst(a, b));
    }
  }

  private newestFirst(a: NewsArticle, b: NewsArticle): number {
    const dateA = a.publishedAtDate?.getTime() ?? new Date(a.publishedAt).getTime() ?? 0;
    const dateB = b.publishedAtDate?.getTime() ?? new Date(b.publishedAt).getTime() ?? 0;
    return dateB - dateA;
  }

  /** Client-side predicate applied per page while the fetch loop compensates. */
  private matchesFilters(article: NewsArticle): boolean {
    const queryLower = this.activeFilter.searchQuery.toLowerCase();
    const matchesQuery =
      !queryLower ||
      article.title.toLowerCase().includes(queryLower) ||
      article.summary.toLowerCase().includes(queryLower) ||
      (article.tickerSentiment ?? []).some((t) => t.ticker.toLowerCase().includes(queryLower));

    const matchesTopics =
      this.activeFilter.topics.length === 0 ||
      this.activeFilter.topics.every((topic) => article.topics.includes(topic));

    const matchesTicker =
      !this.activeFilter.ticker ||
      (article.tickerSentiment ?? []).some(
        (t) => t.ticker.toUpperCase() === this.activeFilter.ticker?.toUpperCase()
      );

    const matchesSentiment =
      !this.activeFilter.sentiment ||
      sentimentBucket(article.overallSentimentScore) === this.activeFilter.sentiment;

    return matchesQuery && matchesTopics && matchesTicker && matchesSentiment;
  }

  onSearchInput(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.applyFilter(this.buildFilter());
    }, 300);
  }

  onTopicFilterClosed(): void {
    this.applyFilter(this.buildFilter());
  }

  onTickerFilterClosed(): void {
    this.applyFilter(this.buildFilter());
  }

  onSentimentChanged(): void {
    this.applyFilter(this.buildFilter());
  }

  onSortChanged(): void {
    // Sorting only reorders what's already loaded — no refetch needed.
    this.activeFilter = { ...this.activeFilter, sort: this.sortMode };
    if (this.sortMode !== 'newest' || this.hasActiveFiltersExceptSort()) {
      this.articles = this.sortArticles(this.articles);
    } else {
      this.articles = [...this.articles].sort((a, b) => this.newestFirst(a, b));
    }
  }

  private hasActiveFiltersExceptSort(): boolean {
    return (
      this.activeFilter.searchQuery.trim().length > 0 ||
      this.activeFilter.topics.length > 0 ||
      !!this.activeFilter.ticker ||
      !!this.activeFilter.sentiment
    );
  }

  private buildFilter(): NewsFilter {
    return {
      searchQuery: this.searchQuery,
      topics: this.selectedTopics,
      ticker: this.selectedTicker.trim(),
      sentiment: (this.selectedSentiment || undefined) as SentimentBucket | undefined,
      sort: this.sortMode,
    };
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
      this.activeFilter.topics.length > 0 ||
      !!this.activeFilter.ticker ||
      !!this.activeFilter.sentiment
    );
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedTopics = [];
    this.selectedTicker = '';
    this.selectedSentiment = '';
    this.applyFilter({ ...this.buildFilter(), sort: this.sortMode });
  }

  removeTopicFilter(topic: string): void {
    this.selectedTopics = this.selectedTopics.filter((t) => t !== topic);
    this.applyFilter(this.buildFilter());
  }

  removeTickerFilter(): void {
    this.selectedTicker = '';
    this.applyFilter(this.buildFilter());
  }

  removeSentimentFilter(): void {
    this.selectedSentiment = '';
    this.applyFilter(this.buildFilter());
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
      ticker: filter.ticker?.trim() ?? '',
      sentiment: filter.sentiment,
      sort: filter.sort ?? this.activeFilter.sort,
    };

    const unchanged =
      normalizedFilter.searchQuery === this.activeFilter.searchQuery &&
      normalizedFilter.topics.length === this.activeFilter.topics.length &&
      normalizedFilter.topics.every((topic) => this.activeFilter.topics.includes(topic)) &&
      normalizedFilter.ticker === this.activeFilter.ticker &&
      normalizedFilter.sentiment === this.activeFilter.sentiment &&
      normalizedFilter.sort === this.activeFilter.sort;

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

  /**
   * Over-fetches raw pages and filters client-side with a compensating
   * loop until pageSize matching articles are gathered or the feed ends.
   * This fixes filtering-after-pagination returning short pages / ending early.
   */
  private loadMore(): void {
    if (this.loading || !this.hasMore) {
      return;
    }

    if (this.articles.length >= this.maxArticlesToShow) {
      this.hasMore = false;
      return;
    }

    this.loading = true;

    const matched: NewsArticle[] = [];
    const seenKeys = new Set(this.articles.map((a) => this.commentService.getArticleKey(a)));
    const maxPagesToScan = 5;
    let cursor = this.lastPublishedAt;
    let pagesScanned = 0;
    let exhaustedRaw = false;

    const finish = (): void => {
      const reordered =
        this.hasActiveFilters && this.activeFilter.sort === 'newest'
          ? this.preferUserTopics(matched)
          : this.sortArticles(matched);

      for (const article of reordered) {
        const key = this.commentService.getArticleKey(article);
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          this.articles.push(article);
        }
      }

      if (this.articles.length > this.maxArticlesToShow) {
        this.articles = this.articles.slice(0, this.maxArticlesToShow);
        this.hasMore = false;
      }

      // Feed is exhausted when Firestore ran out of docs, or a selective
      // filter made us scan maxPagesToScan pages without filling pageSize.
      this.hasMore =
        !exhaustedRaw &&
        pagesScanned < maxPagesToScan &&
        matched.length >= this.pageSize &&
        this.articles.length < this.maxArticlesToShow;

      this.lastPublishedAt = cursor;
      this.loading = false;
    };

    const fetchNextPage = (): void => {
      if (
        matched.length >= this.pageSize ||
        exhaustedRaw ||
        pagesScanned >= maxPagesToScan ||
        this.articles.length >= this.maxArticlesToShow
      ) {
        finish();
        return;
      }

      pagesScanned++;
      this.newsService.getArticlesRaw(this.activeFilter, 0, this.pageSize, cursor).subscribe({
        next: (rawArticles) => {
          if (rawArticles.length === 0) {
            exhaustedRaw = true;
            fetchNextPage();
            return;
          }

          for (const article of rawArticles) {
            if (!this.matchesFilters(article)) continue;
            const key = this.commentService.getArticleKey(article);
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              matched.push(article);
            }
          }

          cursor = rawArticles[rawArticles.length - 1].publishedAt ?? null;
          if (rawArticles.length <= this.pageSize) {
            exhaustedRaw = true;
          }
          fetchNextPage();
        },
        error: () => {
          exhaustedRaw = true;
          finish();
        },
      });
    };

    fetchNextPage();
  }

  private preferUserTopics(articlesList: NewsArticle[]): NewsArticle[] {
    const preferred = articlesList.filter((article) =>
      article.topics.some((t) => this.userPreferredTopics.includes(t))
    );
    const others = articlesList.filter(
      (article) => !article.topics.some((t) => this.userPreferredTopics.includes(t))
    );
    return [...preferred, ...others];
  }
}
