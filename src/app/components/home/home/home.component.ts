import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { SeoService } from '../../../services/seo.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  private readonly seoService = inject(SeoService);

  readonly popularTopics = [
    { name: 'Stock Market', icon: 'trending_up', count: 'Real-time' },
    { name: 'Cryptocurrency', icon: 'currency_bitcoin', count: '24/7' },
    { name: 'Real Estate', icon: 'apartment', count: 'Market data' },
    { name: 'Technology', icon: 'memory', count: 'Earnings' },
    { name: 'Finance & Banking', icon: 'payments', count: 'Fed & Rates' },
    { name: 'Healthcare', icon: 'local_hospital', count: 'Biotech' },
  ];

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: 'Smart Financial News & Market Intelligence',
      description:
        'Track Wall Street movements, crypto volatility, Federal Reserve decisions, and breaking financial headlines with personalized curation and community discussion on Prosperity Pulse.',
      keywords:
        'financial intelligence, stock market news, crypto trends, earnings calendar, economic analysis, personalized finance, investment news, wealth management',
      url: '/',
      type: 'website',
    });
  }
}

