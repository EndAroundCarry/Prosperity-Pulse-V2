import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'prosperity-pulse-dark-mode';

/**
 * Single source of truth for the app theme.
 *
 * Replaces the ad-hoc `document.body.classList.toggle('dark-mode')` in the
 * navbar: a signal persisted to localStorage, defaulting to the OS
 * `prefers-color-scheme`. Chart wrappers subscribe to it and re-render with
 * the matching ECharts theme; Tailwind's `dark:` variant follows the
 * `.dark-mode` class on <body>.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly stored = typeof window !== 'undefined' ? window.localStorage.getItem(THEME_STORAGE_KEY) : null;
  private readonly prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  readonly mode = signal<ThemeMode>(this.initialMode());
  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    // Apply to <body> on construction so the app boots in the right theme.
    this.apply(this.mode());
  }

  toggle(): void {
    this.mode.update((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      this.apply(next);
      return next;
    });
  }

  set(mode: ThemeMode): void {
    this.apply(mode);
    this.mode.set(mode);
  }

  private initialMode(): ThemeMode {
    if (this.stored === 'true') return 'dark';
    if (this.stored === 'false') return 'light';
    return this.prefersDark ? 'dark' : 'light';
  }

  private apply(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('dark-mode', mode === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, mode === 'dark' ? 'true' : 'false');
  }
}
