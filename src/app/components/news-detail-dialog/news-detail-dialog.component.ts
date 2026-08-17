import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { NewsArticle } from '../../models/news-article.model';

@Component({
  selector: 'app-news-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './news-detail-dialog.component.html',
})
export class NewsDetailDialogComponent {
  readonly article = inject<NewsArticle>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<NewsDetailDialogComponent>);

  readMore(): void {
    window.open(this.article.sourceUrl, '_blank', 'noopener,noreferrer');
  }

  close(): void {
    this.dialogRef.close();
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
}

