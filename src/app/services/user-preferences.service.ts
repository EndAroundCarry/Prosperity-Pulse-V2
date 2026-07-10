import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserPreferences {
  selectedTopics: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly preferencesSubject = new BehaviorSubject<UserPreferences>({ selectedTopics: [] });
  readonly preferences$ = this.preferencesSubject.asObservable();

  getPreferences(): Observable<UserPreferences> {
    return this.preferences$;
  }

  setSelectedTopics(topics: string[]): void {
    this.preferencesSubject.next({ selectedTopics: topics });
    localStorage.setItem('prosperity-pulse-user-preferences', JSON.stringify({ selectedTopics: topics }));
  }

  loadPreferences(): void {
    const saved = localStorage.getItem('prosperity-pulse-user-preferences');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        this.preferencesSubject.next(prefs);
      } catch (e) {
        console.error('Failed to load preferences', e);
      }
    }
  }
}
