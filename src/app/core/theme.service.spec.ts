import { TestBed } from '@angular/core/testing';
import { ThemeService, THEME_STORAGE_KEY } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    document.body.classList.remove('dark-mode');
  });

  it('defaults to light when nothing is stored', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('light');
  });

  it('reads a stored dark preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'true');
    const service = TestBed.inject(ThemeService);
    expect(service.mode()).toBe('dark');
    expect(service.isDark()).toBeTrue();
  });

  it('toggles the mode and persists it', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.mode()).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('true');
    expect(document.body.classList.contains('dark-mode')).toBeTrue();

    service.toggle();
    expect(service.mode()).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('false');
  });

  it('applies the .dark-mode class to body on set', () => {
    const service = TestBed.inject(ThemeService);
    service.set('dark');
    expect(document.body.classList.contains('dark-mode')).toBeTrue();
    service.set('light');
    expect(document.body.classList.contains('dark-mode')).toBeFalse();
  });
});
