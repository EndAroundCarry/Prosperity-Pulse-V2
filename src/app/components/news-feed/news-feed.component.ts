import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NewsArticle } from '../../models/news-article.model';
import { NewsService } from '../../services/news.service';
import { NewsDetailDialogComponent } from '../news-detail-dialog/news-detail-dialog.component';

@Component({
  selector: 'app-news-feed',
  imports: [
    DatePipe,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './news-feed.component.html',
})
export class NewsFeedComponent implements AfterViewInit, OnDestroy {
  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLElement>;

  private readonly newsService = inject(NewsService);
  private readonly dialog = inject(MatDialog);
  private observer: IntersectionObserver | null = null;

  readonly pageSize = 12;
  articles: NewsArticle[] = [];
  currentPage = 0;
  loading = false;
  hasMore = true;

  ngAfterViewInit(): void {
    this.loadMore();
    this.setupInfiniteScroll();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
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

  private loadMore(): void {
    if (this.loading || !this.hasMore) {
      return;
    }

    this.loading = true;
    this.newsService.getArticles(this.currentPage, this.pageSize).subscribe({
      next: (articles) => {
        this.articles = [...this.articles, ...articles];
        this.currentPage++;
        this.hasMore = this.articles.length < this.newsService.getTotalCount();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
