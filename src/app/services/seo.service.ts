import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { NewsArticle } from '../models/news-article.model';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
  url?: string;
  imageUrl?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly defaultTitle = 'Prosperity Pulse | Real-Time Financial News & Market Intelligence';
  private readonly defaultDescription =
    'Stay ahead of financial markets with Prosperity Pulse. Real-time stock market updates, cryptocurrency trends, banking analysis, and macroeconomic insights.';
  private readonly defaultKeywords =
    'finance news, stock market news, crypto trends, macroeconomic analysis, investing, earnings reports, business headlines, financial intelligence';
  private readonly siteUrl = 'https://prosperity-pulse.web.app';
  private readonly defaultImage = 'https://prosperity-pulse.web.app/assets/icons/banner.jpg';

  /**
   * Set or update complete SEO meta tags for a page.
   */
  updateSeo(config: Partial<SeoConfig>): void {
    const fullTitle = config.title
      ? `${config.title} | Prosperity Pulse`
      : this.defaultTitle;
    const description = config.description || this.defaultDescription;
    const keywords = config.keywords || this.defaultKeywords;
    const url = config.url ? `${this.siteUrl}${config.url}` : this.siteUrl;
    const imageUrl = config.imageUrl || this.defaultImage;
    const type = config.type || 'website';

    // Standard HTML Title & Meta
    this.titleService.setTitle(fullTitle);
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ name: 'keywords', content: keywords });
    this.metaService.updateTag({ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' });

    // OpenGraph (Facebook / LinkedIn / Discord / Slack)
    this.metaService.updateTag({ property: 'og:title', content: fullTitle });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:url', content: url });
    this.metaService.updateTag({ property: 'og:type', content: type });
    this.metaService.updateTag({ property: 'og:image', content: imageUrl });
    this.metaService.updateTag({ property: 'og:site_name', content: 'Prosperity Pulse' });
    this.metaService.updateTag({ property: 'og:locale', content: 'en_US' });

    // Twitter Cards
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: fullTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    this.metaService.updateTag({ name: 'twitter:image', content: imageUrl });

    // Canonical link
    this.setCanonicalUrl(url);
  }

  /**
   * Set canonical link element in <head>.
   */
  setCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /**
   * Set dynamic JSON-LD structured data schema in <head>.
   */
  setStructuredData(schema: object, scriptId = 'json-ld-schema'): void {
    let script = this.document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.text = JSON.stringify(schema);
  }

  /**
   * Generate and apply Google NewsArticle Schema for active article.
   */
  setArticleStructuredData(
    article: NewsArticle,
    stats?: { likes?: number; dislikes?: number; commentCount?: number }
  ): void {
    this.updateSeo({
      title: article.title,
      description: article.summary,
      keywords: article.topics.join(', '),
      imageUrl: article.imageUrl,
      type: 'article',
      author: article.authors?.join(', ') || article.sourceName,
      publishedTime: article.publishedAt,
    });

    const articleSchema = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': article.sourceUrl || this.siteUrl,
      },
      'headline': article.title,
      'description': article.summary,
      'image': [article.imageUrl],
      'datePublished': article.publishedAt,
      'dateModified': article.publishedAt,
      'author': {
        '@type': 'Person',
        'name': article.authors?.length ? article.authors[0] : article.sourceName,
      },
      'publisher': {
        '@type': 'NewsMediaOrganization',
        'name': article.sourceName || 'Prosperity Pulse',
        'url': this.siteUrl,
        'logo': {
          '@type': 'ImageObject',
          'url': `${this.siteUrl}/favicon.ico`,
        },
      },
      'articleSection': article.topics,
      'interactionStatistic': [
        {
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/LikeAction',
          'userInteractionCount': stats?.likes || 0,
        },
        {
          '@type': 'InteractionCounter',
          'interactionType': 'https://schema.org/CommentAction',
          'userInteractionCount': stats?.commentCount || 0,
        },
      ],
    };

    this.setStructuredData(articleSchema, 'json-ld-article-schema');
  }

  /**
   * Remove article structured data script when dialog closes.
   */
  clearArticleStructuredData(): void {
    const script = this.document.getElementById('json-ld-article-schema');
    if (script) {
      script.remove();
    }
  }
}
