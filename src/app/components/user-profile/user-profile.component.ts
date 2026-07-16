import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { NewsService, NewsFilter } from '../../services/news.service';
import { Observable } from 'rxjs';
import { User } from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { NewsArticle } from '../../models/news-article.model';
import { NewsDetailDialogComponent } from '../news-detail-dialog/news-detail-dialog.component';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css'],
})
export class UserProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userPrefsService = inject(UserPreferencesService);
  private readonly newsService = inject(NewsService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  user$: Observable<User | null> = this.authService.currentUser$;
  allTopics: string[] = [];
  selectedTopics: string[] = [];

  // News lists
  matchedNews: NewsArticle[] = [];
  otherNews: NewsArticle[] = [];
  newsArticles: NewsArticle[] = [];

  ngOnInit(): void {
    if (environment.disableAuth) {
      // Provide test data when authentication is disabled for testing purposes
      this.user$ = new Observable<User | null>((observer) => {
        observer.next({
          uid: 'user-123456-abcde',
          email: 'dev.tester@example.com',
          emailVerified: true,
          displayName: 'Alex Developer',
          isAnonymous: false,
          photoURL: 'https://example.com/profiles/alex.jpg',
          phoneNumber: '+15555550123',
          providerId: 'firebase',
          tenantId: null,
          metadata: {
            creationTime: new Date('2026-01-01T00:00:00Z').toUTCString(),
            lastSignInTime: new Date('2026-07-09T08:00:00Z').toUTCString(),
          },
          providerData: [
            {
              uid: 'user-123456-abcde',
              displayName: 'Alex Developer',
              email: 'dev.tester@example.com',
              phoneNumber: '+15555550123',
              photoURL: 'https://example.com/profiles/alex.jpg',
              providerId: 'password',
            },
          ],
          getIdToken: () => Promise.resolve('mock-id-token-xyz'),
          getIdTokenResult: () =>
            Promise.resolve({
              token: 'mock-id-token-xyz',
              authTime: '2026-07-09T08:00:00Z',
              issuedAtTime: '2026-07-09T08:00:00Z',
              expirationTime: '2026-07-09T09:00:00Z',
              signInProvider: 'password',
              claims: {},
            }),
          reload: () => Promise.resolve(),
          delete: () => Promise.resolve(),
          toJSON: () => ({}),
        } as User);
        observer.complete();
      });

      this.allTopics = [
        'Finance',
        'Stock Market',
        'Cryptocurrency',
        'Real Estate',
        'Technology',
        'Healthcare',
      ];
      this.selectedTopics = ['Finance', 'Technology'];

      this.userPrefsService.setSelectedTopics(this.selectedTopics);
    } else {
      this.user$.subscribe((user) => {
        if (!user) {
          // this.router.navigate(['/']);
        }
      });

      this.newsService.getAllTopics().subscribe((topics) => {
        this.allTopics = topics;
      });

      this.userPrefsService.loadPreferences();
      this.userPrefsService.getPreferences().subscribe((prefs) => {
        this.selectedTopics = prefs.selectedTopics;
        // After preferences are loaded, fetch news
        this.loadNews();
      });
    }
  }

  toggleTopic(topic: string): void {
    const index = this.selectedTopics.indexOf(topic);
    if (index > -1) {
      this.selectedTopics.splice(index, 1);
    } else {
      this.selectedTopics.push(topic);
    }
    this.userPrefsService.setSelectedTopics(this.selectedTopics);
    // Refresh news when topics change
    this.loadNews();
  }

  /**
   * Fetch news articles, prioritizing those that match the user's selected topics.
   */
  private loadNews(): void {
    const pageSize = 50;
    const filterWithTopics: NewsFilter = { searchQuery: '', topics: this.selectedTopics };
    const filterAll: NewsFilter = { searchQuery: '', topics: [] };

    // Fetch matched articles first
    this.newsService
      .getArticlesRaw(filterWithTopics, 0, pageSize)
      .subscribe((matched) => {
        this.matchedNews = matched;

        // Fetch all articles to find the remaining ones
        this.newsService
          .getArticlesRaw(filterAll, 0, pageSize)
          .subscribe((all) => {
            const matchedIds = new Set(this.matchedNews.map((a) => a.id));
            this.otherNews = all.filter((a) => !matchedIds.has(a.id));

            // Combine lists: matched first, then others
            this.newsArticles = [...this.matchedNews, ...this.otherNews];
          });
      });
  }

  /**
   * Open the article detail dialog.
   */
  openArticle(article: NewsArticle): void {
    this.dialog.open(NewsDetailDialogComponent, {
      data: article,
      maxWidth: '640px',
      width: '95vw',
      panelClass: 'news-detail-dialog',
    });
  }
}
