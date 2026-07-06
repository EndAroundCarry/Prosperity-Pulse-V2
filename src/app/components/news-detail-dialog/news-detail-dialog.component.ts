import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NewsArticle } from '../../models/news-article.model';

@Component({
  selector: 'app-news-detail-dialog',
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule],
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
}
