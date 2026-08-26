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
  {
    path: 'about-data',
    loadComponent: () =>
      import('./components/about-data/about-data.component').then((m) => m.AboutDataPageComponent),
  },
  // A real 404 rather than `redirectTo: ''`, which produced soft 404s: every
  // unknown URL returned the homepage with a 200 status.
  {
    path: '**',
    loadComponent: () =>
      import('./components/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
