import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { SeoService } from '../../services/seo.service';
import { Observable, firstValueFrom } from 'rxjs';
import { User } from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { Firestore, doc, setDoc, getDoc, updateDoc, collection, collectionData, query, where } from '@angular/fire/firestore';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css'],
})
export class UserProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userPrefsService = inject(UserPreferencesService);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly seoService = inject(SeoService);

  user$: Observable<User | null> = this.authService.currentUser$;
  allTopics: string[] = [];
  selectedTopics: string[] = [];
  savedTopics: string[] = [];
  hasChanges: boolean = false;
  isSaving: boolean = false;
  isLoading: boolean = true;
  userId: string = '';

  async ngOnInit(): Promise<void> {
    this.seoService.updateSeo({
      title: 'My News Preferences & Profile',
      description:
        'Manage your Prosperity Pulse topic preferences, personalize your financial news feed, and control your account settings.',
      keywords: 'profile settings, topic preferences, financial news personalization',
      url: '/profile',
    });
    this.user$.subscribe(async (user) => {
      if (!user) {
        this.isLoading = false;
        return;
      }

      // Use the user's email as the unique identifier; fallback to uid if email is missing
      this.userId = user.email ?? user.uid;

      const initFirestore = async () => {
        const userRef = doc(this.firestore, 'users', this.userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uuid: this.userId,
            selectedTopics: [],
          });
          this.selectedTopics = [];
          this.savedTopics = [];
        } else {
          const data = userSnap.data();
          this.selectedTopics = [...(data['selectedTopics'] || [])];
          this.savedTopics = [...this.selectedTopics];
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

      try {
        if (environment.disableAuth) {
          this.allTopics = [
            'Finance',
            'Stock Market',
            'Cryptocurrency',
            'Real Estate',
            'Technology',
            'Healthcare',
          ];
          this.selectedTopics = ['Finance', 'Technology'];
          this.savedTopics = [...this.selectedTopics];
          this.userPrefsService.setSelectedTopics(this.selectedTopics);

          // Ensure mock topics exist in the distinct topics collection
          await Promise.all(this.allTopics.map((t) => this.ensureTopicExists(t)));

          await initFirestore();
          await persistTopics(this.selectedTopics);
        } else {
          // Load topics from Firestore distinct collection
          const topics = await this.loadTopicsFromFirestore();
          this.allTopics = topics;

          await initFirestore();
          await persistTopics(this.selectedTopics);

          this.userPrefsService.loadPreferences();
          this.userPrefsService.getPreferences().subscribe((prefs) => {
            this.selectedTopics = [...prefs.selectedTopics];
            this.savedTopics = [...prefs.selectedTopics];
          });
        }
      } catch (error) {
        console.error('Error initializing profile data:', error);
      } finally {
        this.isLoading = false;
      }
    });
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

  isTopicSelected(topic: string): boolean {
    return this.selectedTopics.includes(topic);
  }

  toggleTopic(topic: string): void {
    const index = this.selectedTopics.indexOf(topic);
    if (index > -1) {
      this.selectedTopics.splice(index, 1);
    } else {
      this.selectedTopics.push(topic);
    }
    this.checkForChanges();
    this.userPrefsService.setSelectedTopics(this.selectedTopics);

    // Ensure topic exists in distinct topics collection
    this.ensureTopicExists(topic).catch(console.error);
  }

  selectAllTopics(): void {
    this.selectedTopics = [...this.allTopics];
    this.checkForChanges();
    this.userPrefsService.setSelectedTopics(this.selectedTopics);
  }

  clearAllTopics(): void {
    this.selectedTopics = [];
    this.checkForChanges();
    this.userPrefsService.setSelectedTopics(this.selectedTopics);
  }

  resetChanges(): void {
    this.selectedTopics = [...this.savedTopics];
    this.hasChanges = false;
    this.userPrefsService.setSelectedTopics(this.selectedTopics);
    this.snackBar.open('Changes discarded', 'Dismiss', {
      duration: 2500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  private checkForChanges(): void {
    const sortedSelected = [...this.selectedTopics].sort();
    const sortedSaved = [...this.savedTopics].sort();
    this.hasChanges = JSON.stringify(sortedSelected) !== JSON.stringify(sortedSaved);
  }

  async saveChanges(): Promise<void> {
    if (!this.hasChanges || this.isSaving) return;
    this.isSaving = true;

    try {
      const userRef = doc(this.firestore, 'users', this.userId);
      await updateDoc(userRef, {
        selectedTopics: this.selectedTopics,
      });
      this.savedTopics = [...this.selectedTopics];
      this.hasChanges = false;
      this.snackBar.open('Profile preferences saved successfully!', 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } catch (error) {
      console.error('Error saving profile changes:', error);
      this.snackBar.open('Failed to save preferences. Please try again.', 'Close', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    } finally {
      this.isSaving = false;
    }
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
    return 'PP';
  }

  copyUserId(): void {
    if (this.userId) {
      navigator.clipboard.writeText(this.userId).then(() => {
        this.snackBar.open('User ID copied to clipboard', 'OK', {
          duration: 2000,
        });
      });
    }
  }
}

