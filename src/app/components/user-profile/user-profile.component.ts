import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { Observable, firstValueFrom } from 'rxjs';
import { User } from 'firebase/auth';
import { environment } from '../../../environments/environment';
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
  ],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css'],
})
export class UserProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userPrefsService = inject(UserPreferencesService);
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);

  user$: Observable<User | null> = this.authService.currentUser$;
  allTopics: string[] = [];
  selectedTopics: string[] = [];
  hasChanges: boolean = false;
  private userId: string = '';

  async ngOnInit(): Promise<void> {
    this.user$.subscribe(async (user) => {
      if (!user) {
        // this.router.navigate(['/']);
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
          this.selectedTopics = prefs.selectedTopics;
        });
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
  }

  async saveChanges(): Promise<void> {
    if (!this.hasChanges) return;
    const userRef = doc(this.firestore, 'users', this.userId);
    await updateDoc(userRef, {
      selectedTopics: this.selectedTopics,
    });
    this.hasChanges = false;
  }
}
