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
import { Observable, firstValueFrom } from 'rxjs';
import { User } from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { NewsArticle } from '../../models/news-article.model';
import { NewsDetailDialogComponent } from '../news-detail-dialog/news-detail-dialog.component';
import { Firestore, doc, setDoc, getDoc, updateDoc, collection, collectionData, query, where } from '@angular/fire/firestore';

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
  private readonly firestore = inject(Firestore);

  user$: Observable<User | null> = this.authService.currentUser$;
  allTopics: string[] = [];
  selectedTopics: string[] = [];
  hasChanges: boolean = false;
  private userId: string = '';

  // News lists
  matchedNews: NewsArticle[] = [];
  otherNews: NewsArticle[] = [];
  newsArticles: NewsArticle[] = [];

  async ngOnInit(): Promise<void> {
    this.userId = self.crypto.randomUUID();

    const initFirestore = async () => {
      const userRef = doc(this.firestore, 'users', this.userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uuid: this.userId,
          selectedTopics: [],
        });
      } else {
        const data = userSnap.data();
        this.selectedTopics = data['selectedTopics'] || [];
        this.userPrefsService.setSelectedTopics(this.selectedTopics);
      }
      this.hasChanges = false;
    };

    const persistTopics = async (topics: string[]) => {
      const userRef = doc(this.firestore, 'users', this.userId);
      await updateDoc(userRef, {
        selectedTopics: topics,
      });
    };

    if (environment.disableAuth) {
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

      // Ensure mock topics exist in the distinct topics collection
      await Promise.all(this.allTopics.map(t => this.ensureTopicExists(t)));
      
      initFirestore().then(() => {
        persistTopics(this.selectedTopics);
        this.loadNews();
      });
    } else {
      this.user$.subscribe((user) => {
        if (!user) {
          // this.router.navigate(['/']);
        }
      });

      // Load topics from Firestore distinct collection
      this.loadTopicsFromFirestore().then((topics) => {
        this.allTopics = topics;
        initFirestore().then(() => {
          persistTopics(this.selectedTopics);
        });
      });

      this.userPrefsService.loadPreferences();
      this.userPrefsService.getPreferences().subscribe((prefs) => {
        this.selectedTopics = prefs.selectedTopics;
        initFirestore().then(() => {
          this.loadNews();
        });
      });
    }
  }

  private async loadTopicsFromFirestore(): Promise<string[]> {
    const topicsRef = collection(this.firestore, 'topics');
    const topicsSnap = await firstValueFrom(collectionData(topicsRef));
    return (topicsSnap as any[]).map((t: any) => t.name).sort();
  }

  private async ensureTopicExists(topicName: string): Promise<void> {
    const topicsRef = collection(this.firestore, 'topics');
    const q = query(topicsRef, where('name', '==', topicName));
    const snap = await firstValueFrom(collectionData(q));
    if ((snap as any[]).length === 0) {
      await setDoc(doc(topicsRef, self.crypto.randomUUID()), { name: topicName });
    }
  }

  toggleTopic(topic: string): void {
    const index = this.selectedTopics.indexOf(topic);
    if (index > -1) {
      this.selectedTopics.splice(index, 1);
    } else {
      this.selectedTopics.push(topic);
    }
    this.hasChanges = true;
    this.userPrefsService.setSelectedTopics(this.selectedTopics);
    
    // Ensure topic exists in distinct topics collection
    this.ensureTopicExists(topic).catch(console.error);

    // Refresh news when topics change
    this.loadNews();
  }

  async saveChanges(): Promise<void> {
    if (!this.hasChanges) return;
    const userRef = doc(this.firestore, 'users', this.userId);
    await updateDoc(userRef, {
      selectedTopics: this.selectedTopics,
    });
    this.hasChanges = false;
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
