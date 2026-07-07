import { Component, OnInit, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavbarComponent } from './components/navbar/navbar.component';
import { NewsFeedComponent } from './components/news-feed/news-feed.component';
import { MatDialog } from '@angular/material/dialog';
import { LoginDialogComponent } from './components/login-dialog/login-dialog.component';

@Component({
  selector: 'app-root',
  imports: [
    NavbarComponent,
    NewsFeedComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    const siteName = 'Prosperity Pulse';
    const description = 'Prosperity Pulse delivers timely finance news, market trends, investing insights, and economic updates in a fast, mobile-friendly experience.';
    const keywords = 'finance news, stock market news, investing insights, market trends, economic updates, business headlines';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://prosperity-pulse.web.app/';

    this.title.setTitle(`${siteName} | Finance news and market insights`);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'keywords', content: keywords });
    this.meta.updateTag({ name: 'author', content: siteName });
    this.meta.updateTag({ name: 'robots', content: 'index,follow,max-image-preview:large' });
    this.meta.updateTag({ name: 'theme-color', content: '#0f172a' });
    this.meta.updateTag({ property: 'og:title', content: `${siteName} | Finance news and market insights` });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: siteName });
    this.meta.updateTag({ property: 'og:url', content: currentUrl });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: `${siteName} | Finance news and market insights` });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ rel: 'canonical', href: currentUrl });

    this.addStructuredData();
  }

  openLogin(): void {
    this.dialog.open(LoginDialogComponent, {
      width: '400px'
    });
  }

  private addStructuredData(): void {
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Prosperity Pulse',
      url: 'https://prosperity-pulse.web.app/',
      description: 'Prosperity Pulse delivers timely finance news, market trends, investing insights, and economic updates in a fast, mobile-friendly experience.',
      applicationCategory: 'NewsApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      }
    });

    document.head.appendChild(script);
  }
}
