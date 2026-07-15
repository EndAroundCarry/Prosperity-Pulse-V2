import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { NewsArticle } from '../../models/news-article.model';
import { NewsFilter, NewsService } from '../../services/news.service';
import { NewsDetailDialogComponent } from '../news-detail-dialog/news-detail-dialog.component';

@Component({
  selector: 'app-news-feed',
  imports: [
    DatePipe,
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './news-feed.component.html',
})
export class NewsFeedComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLElement>;

  private readonly newsService = inject(NewsService);
  private readonly dialog = inject(MatDialog);
  private observer: IntersectionObserver | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly pageSize = 12;
  allTopics: string[] = [];

  articles: NewsArticle[] = [];
  currentPage = 0;
  loading = false;
  hasMore = true;
  private maxArticlesToShow = 100; // Limit total articles shown to prevent memory issues

  searchQuery = '';
  selectedTopics: string[] = [];
  private activeFilter: NewsFilter = { searchQuery: '', topics: [] };

  // Track pagination state for Firestore
  private lastPublishedAt: string | null = null;

  ngOnInit(): void {
    this.newsService.getAllTopics().subscribe((topics) => {
      this.allTopics = topics;
    });
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

          // Only add new articles if they don't already exist
          const newArticles = filtered.filter(
            (article) => !this.articles.some((existing) => existing.id === article.id)
          );

          // Limit total articles to prevent memory issues
          const combinedArticles = [...this.articles, ...newArticles];
          if (combinedArticles.length > this.maxArticlesToShow) {
            this.articles = combinedArticles.slice(0, this.maxArticlesToShow);
            this.hasMore = false;
          } else {
            this.articles = combinedArticles;
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
