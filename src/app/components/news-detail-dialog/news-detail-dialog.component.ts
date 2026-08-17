import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, Subscription } from 'rxjs';
import { User } from 'firebase/auth';
import { NewsArticle } from '../../models/news-article.model';
import { CommentItem, ArticleReaction } from '../../models/comment.model';
import { CommentService } from '../../services/comment.service';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-news-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './news-detail-dialog.component.html',
})
export class NewsDetailDialogComponent implements OnInit {
  readonly article = inject<NewsArticle>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<NewsDetailDialogComponent>);
  private readonly commentService = inject(CommentService);
  private readonly authService = inject(AuthService);
  private readonly seoService = inject(SeoService);

  articleKey = '';
  user$: Observable<User | null> = this.authService.currentUser$;
  currentUser: User | null = null;
  currentUserId = '';

  comments$: Observable<CommentItem[]> = new Observable();
  articleReaction$: Observable<ArticleReaction | null> = new Observable();

  newCommentText = '';
  isPostingComment = false;

  private userSub?: Subscription;

  ngOnInit(): void {
    this.articleKey = this.commentService.getArticleKey(this.article);
    this.comments$ = this.commentService.getComments(this.articleKey);
    // Inject NewsArticle JSON-LD schema when dialog opens
    this.seoService.setArticleStructuredData(this.article);
    this.articleReaction$ = this.commentService.getArticleReactions(this.articleKey);

    this.userSub = this.user$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
        this.currentUserId = user.email ?? user.uid;
      } else {
        // Generate or retrieve guest identifier
        let guestId = localStorage.getItem('prosperity-pulse-guest-id');
        if (!guestId) {
          guestId = 'guest_' + self.crypto.randomUUID().slice(0, 8);
          localStorage.setItem('prosperity-pulse-guest-id', guestId);
        }
        this.currentUserId = guestId;
      }
    });
  }

  async postComment(): Promise<void> {
    if (!this.newCommentText.trim() || this.isPostingComment) return;

    this.isPostingComment = true;
    try {
      await this.commentService.addComment(
        this.articleKey,
        this.newCommentText,
        this.currentUser || {
          uid: this.currentUserId,
          email: null,
          displayName: 'Guest Reader',
          photoURL: null,
        }
      );
      this.newCommentText = '';
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      this.isPostingComment = false;
    }
  }

  async toggleArticleReaction(type: 'like' | 'dislike'): Promise<void> {
    try {
      await this.commentService.toggleArticleReaction(
        this.articleKey,
        type,
        this.currentUserId
      );
    } catch (err) {
      console.error('Failed to toggle article reaction:', err);
    }
  }

  async toggleCommentReaction(comment: CommentItem, type: 'like' | 'dislike'): Promise<void> {
    try {
      await this.commentService.toggleCommentReaction(
        comment.id,
        type,
        this.currentUserId
      );
    } catch (err) {
      console.error('Failed to toggle comment reaction:', err);
    }
  }

  isArticleLiked(reaction: ArticleReaction | null): boolean {
    return Boolean(reaction?.likedBy?.includes(this.currentUserId));
  }

  isArticleDisliked(reaction: ArticleReaction | null): boolean {
    return Boolean(reaction?.dislikedBy?.includes(this.currentUserId));
  }

  isCommentLiked(comment: CommentItem): boolean {
    return Boolean(comment.likedBy?.includes(this.currentUserId));
  }

  isCommentDisliked(comment: CommentItem): boolean {
    return Boolean(comment.dislikedBy?.includes(this.currentUserId));
  }

  readMore(): void {
    window.open(this.article.sourceUrl, '_blank', 'noopener,noreferrer');
  }

  close(): void {
    this.userSub?.unsubscribe();
    this.seoService.clearArticleStructuredData();
    this.dialogRef.close();
  }

  getInitials(name?: string | null, email?: string | null): string {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email && email.trim().length > 0) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'PR';
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


