import { Routes } from '@angular/router';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { NewsFeedComponent } from './components/news-feed/news-feed.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'news-feed', component: NewsFeedComponent },
  { path: 'profile', component: UserProfileComponent }
];
