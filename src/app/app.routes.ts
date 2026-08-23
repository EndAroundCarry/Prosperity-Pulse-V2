import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: 'news-feed',
    loadComponent: () =>
      import('./components/news-feed/news-feed.component').then(
        (m) => m.NewsFeedComponent
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/user-profile/user-profile.component').then(
        (m) => m.UserProfileComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
