import { Component } from '@angular/core';
import { NewsFeedComponent } from '../../news-feed/news-feed.component';

@Component({
  selector: 'app-home',
  imports: [
    NewsFeedComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
