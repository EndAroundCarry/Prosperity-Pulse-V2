import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { NewsService } from '../../services/news.service';
import { Observable } from 'rxjs';
import { User } from 'firebase/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatButtonModule, MatIconModule],
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userPrefsService = inject(UserPreferencesService);
  private readonly newsService = inject(NewsService);
  private readonly router = inject(Router);

  user$: Observable<User | null> = this.authService.currentUser$;
  allTopics: string[] = [];
  selectedTopics: string[] = [];

  ngOnInit(): void {
    console.log("here");
    if (environment.disableAuth) {
      // Provide test data when authentication is disabled for testing purposes
      this.user$ = new Observable<User | null>(observer => {
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
          // Metadata fields
          metadata: {
            creationTime: new Date('2026-01-01T00:00:00Z').toUTCString(),
            lastSignInTime: new Date('2026-07-09T08:00:00Z').toUTCString(),
          },
          // Provider data array (e.g., Google, Password, etc.)
          providerData: [
            {
              uid: 'user-123456-abcde',
              displayName: 'Alex Developer',
              email: 'dev.tester@example.com',
              phoneNumber: '+15555550123',
              photoURL: 'https://example.com/profiles/alex.jpg',
              providerId: 'password',
            }
          ],
          // Mocking the essential methods required by the User interface
          getIdToken: () => Promise.resolve('mock-id-token-xyz'),
          getIdTokenResult: () => Promise.resolve({
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
      
      this.allTopics = ['Finance', 'Stock Market', 'Cryptocurrency', 'Real Estate', 'Technology', 'Healthcare'];
      this.selectedTopics = ['Finance', 'Technology'];
      
      this.userPrefsService.setSelectedTopics(this.selectedTopics);
    } else {
      this.user$.subscribe(user => {
        if (!user) {
          // this.router.navigate(['/']);
        }
      });

      this.newsService.getAllTopics().subscribe(topics => {
        this.allTopics = topics;
      });
      
      this.userPrefsService.loadPreferences();
      this.userPrefsService.getPreferences().subscribe(prefs => {
        this.selectedTopics = prefs.selectedTopics;
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
  }
}
