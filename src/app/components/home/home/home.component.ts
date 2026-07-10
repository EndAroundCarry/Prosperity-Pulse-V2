import { Component } from '@angular/core';
import { NewsFeedComponent } from '../../news-feed/news-feed.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [
    RouterModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
