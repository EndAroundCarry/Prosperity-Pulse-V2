import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SiteFooterComponent } from './shared/components/site-footer.component';
import { SeoService } from './services/seo.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavbarComponent, RouterOutlet, SiteFooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly seoService = inject(SeoService);

  ngOnInit(): void {
    this.seoService.updateSeo({});
    this.seoService.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Prosperity Pulse',
      url: 'https://prosperity-pulse.web.app/',
      description:
        'Prosperity Pulse delivers timely finance news, market trends, investing insights, and economic updates in a fast, mobile-friendly experience.',
      applicationCategory: 'NewsApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    });
  }
}
