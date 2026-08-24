import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'news-feed',
    loadComponent: () =>
      import('./components/news-feed/news-feed.component').then((m) => m.NewsFeedComponent),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/user-profile/user-profile.component').then((m) => m.UserProfileComponent),
  },
  {
    path: 'ticker/:symbol',
    loadComponent: () =>
      import('./components/ticker/ticker-page.component').then((m) => m.TickerPageComponent),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./components/calendar/calendar-page.component').then((m) => m.CalendarPageComponent),
  },
  {
    path: 'macro',
    loadComponent: () =>
      import('./components/macro/macro-page.component').then((m) => m.MacroPageComponent),
  },
  { path: '**', redirectTo: '' }, // 404 fallback (dedicated page is Phase 9 polish)
];
