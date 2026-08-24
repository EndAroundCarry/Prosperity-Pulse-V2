import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { provideAppInitializer, inject as diInject } from '@angular/core';

export interface UserPreferences {
  selectedTopics: string[];
  /** Widget ids the user hid — the main lever for "clutter free". */
  hiddenWidgets: string[];
  /** Widget ids in display order; ids missing here go last (stable). */
  widgetOrder: string[];
}

const STORAGE_KEY = 'prosperity-pulse-user-preferences';
const DEFAULTS: UserPreferences = { selectedTopics: [], hiddenWidgets: [], widgetOrder: [] };

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly preferencesSubject = new BehaviorSubject<UserPreferences>({ ...DEFAULTS });
  readonly preferences$ = this.preferencesSubject.asObservable();

  getPreferences() {
    return this.preferences$;
  }

  /** Synchronous snapshot for initial signal values. */
  getPreferencesValue(): UserPreferences {
    return this.preferencesSubject.value;
  }

  setSelectedTopics(topics: string[]): void {
    this.update({ selectedTopics: topics });
  }

  setHiddenWidgets(ids: string[]): void {
    this.update({ hiddenWidgets: ids });
  }

  setWidgetOrder(ids: string[]): void {
    this.update({ widgetOrder: ids });
  }

  loadPreferences(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      this.preferencesSubject.next({ ...DEFAULTS, ...JSON.parse(saved) });
    } catch (e) {
      console.error('Failed to load preferences', e);
    }
  }

  private update(patch: Partial<UserPreferences>): void {
    const next = { ...this.preferencesSubject.value, ...patch };
    this.preferencesSubject.next(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
}

/**
 * Phase 6 fix: loadPreferences() was only called from UserProfileComponent,
 * so preferences never restored on app start. Restore them in an app
 * initializer instead.
 */
export function providePreferencesInitializer() {
  return provideAppInitializer(() => {
    diInject(UserPreferencesService).loadPreferences();
  });
}
