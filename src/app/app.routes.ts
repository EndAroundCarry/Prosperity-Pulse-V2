import { Routes } from '@angular/router';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { NewsFeedComponent } from './components/news-feed/news-feed.component';
import { HomeComponent } from './components/home/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'profile', component: UserProfileComponent }
];
