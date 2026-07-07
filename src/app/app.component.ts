import { Component } from '@angular/core';
import { NavbarComponent } from './components/navbar/navbar.component';
import { NewsFeedComponent } from './components/news-feed/news-feed.component';

@Component({
  selector: 'app-root',
  imports: [
    NavbarComponent,
    NewsFeedComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}
