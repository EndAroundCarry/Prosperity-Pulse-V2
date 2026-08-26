import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { NewsArticle } from '../models/news-article.model';

export const SITE_URL = 'https://prosperity-pulse.web.app';
export const SITE_NAME = 'Prosperity Pulse';

/** Default social share card (1200x630, the OG-recommended aspect ratio). */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
const DEFAULT_OG_IMAGE_WIDTH = '1200';
const DEFAULT_OG_IMAGE_HEIGHT = '630';

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string;
  url?: string;
  imageUrl?: string;
  imageAlt?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  section?: string;
  /**
   * Robots directive for this page. Defaults to indexable. Pass 'noindex' for
   * private or thin pages (profile, 404) so they never enter the index.
   */
  robots?: 'index' | 'noindex';
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  private readonly defaultTitle = 'Prosperity Pulse | Real-Time Financial News & Market Intelligence';
  private readonly defaultDescription =
    'Stay ahead of financial markets with Prosperity Pulse. Real-time stock market updates, cryptocurrency trends, banking analysis, and macroeconomic insights.';
  private readonly defaultKeywords =
    'finance news, stock market news, crypto trends, macroeconomic analysis, investing, earnings reports, business headlines, financial intelligence';
  private readonly siteUrl = SITE_URL;
  private readonly defaultImage = DEFAULT_OG_IMAGE;

  /**
   * Set or update complete SEO meta tags for a page.
   *
   * Every page should call this on init — it also resets per-page tags that a
   * previously visited route may have set, which is what keeps titles from
   * going stale during in-app navigation.
   */
  updateSeo(config: Partial<SeoConfig>): void {
    const fullTitle = config.title
      ? `${config.title} | ${SITE_NAME}`
      : this.defaultTitle;
    const description = config.description || this.defaultDescription;
    const keywords = config.keywords || this.defaultKeywords;
    const url = `${this.siteUrl}${config.url ?? this.currentPath()}`;
    const imageUrl = config.imageUrl || this.defaultImage;
    const imageAlt = config.imageAlt || `${SITE_NAME} — ${config.title || 'Financial News Intelligence'}`;
    const type = config.type || 'website';
    const noindex = config.robots === 'noindex';

    // Standard HTML Title & Meta
    this.titleService.setTitle(fullTitle);
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ name: 'keywords', content: keywords });
    this.metaService.updateTag({
      name: 'robots',
      content: noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    });

    // OpenGraph (Facebook / LinkedIn / Discord / Slack)
    this.metaService.updateTag({ property: 'og:title', content: fullTitle });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:url', content: url });
    this.metaService.updateTag({ property: 'og:type', content: type });
    this.metaService.updateTag({ property: 'og:image', content: imageUrl });
    this.metaService.updateTag({ property: 'og:image:alt', content: imageAlt });
    this.metaService.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.metaService.updateTag({ property: 'og:locale', content: 'en_US' });

    // Explicit dimensions let crawlers render the card without fetching the
    // image first. Only correct for our own default card.
    if (imageUrl === this.defaultImage) {
      this.metaService.updateTag({ property: 'og:image:width', content: DEFAULT_OG_IMAGE_WIDTH });
      this.metaService.updateTag({ property: 'og:image:height', content: DEFAULT_OG_IMAGE_HEIGHT });
    } else {
      this.removeTag("property='og:image:width'");
      this.removeTag("property='og:image:height'");
    }

    // Article-specific OpenGraph. These were previously accepted in the config
    // and silently dropped.
    if (type === 'article') {
      if (config.publishedTime) {
        this.metaService.updateTag({ property: 'article:published_time', content: config.publishedTime });
      }
      if (config.author) {
        this.metaService.updateTag({ property: 'article:author', content: config.author });
      }
      if (config.section) {
        this.metaService.updateTag({ property: 'article:section', content: config.section });
      }
    } else {
      this.removeTag("property='article:published_time'");
      this.removeTag("property='article:author'");
      this.removeTag("property='article:section'");
    }

    // Twitter Cards
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: fullTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    this.metaService.updateTag({ name: 'twitter:image', content: imageUrl });
    this.metaService.updateTag({ name: 'twitter:image:alt', content: imageAlt });

    // Canonical link
    this.setCanonicalUrl(url);
  }

  /**
   * Current route path, without query string or fragment.
   *
   * Used as the canonical fallback so that overlays which have no URL of their
   * own (the article dialog) do not rewrite the canonical to the site root.
   */
  private currentPath(): string {
    const url = this.router.url ?? '/';
    const path = url.split('#')[0].split('?')[0];
    return path === '/' ? '' : path;
  }

  private removeTag(selector: string): void {
    try {
      this.metaService.removeTag(selector);
    } catch {
      // removeTag throws if the tag was never added; harmless.
    }
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

  private removeStructuredData(scriptId: string): void {
    this.document.getElementById(scriptId)?.remove();
  }

  /**
   * Emit a BreadcrumbList for the current page so search results can render
   * the site hierarchy instead of a bare URL.
   *
   * Pass the trail without the site root — it is prepended automatically.
   */
  setBreadcrumbs(trail: Array<{ name: string; url: string }>): void {
    const items = [{ name: 'Home', url: '/' }, ...trail];
    this.setStructuredData(
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: `${this.siteUrl}${item.url}`,
        })),
      },
      'json-ld-breadcrumbs'
    );
  }

  clearBreadcrumbs(): void {
    this.removeStructuredData('json-ld-breadcrumbs');
  }

  /**
   * Describe the current route as a WebPage node. Cheap, and gives crawlers an
   * explicit title/description/lastReviewed triple per page.
   */
  setPageStructuredData(page: {
    name: string;
    description: string;
    url: string;
    type?: string;
  }): void {
    this.setStructuredData(
      {
        '@context': 'https://schema.org',
        '@type': page.type || 'WebPage',
        name: page.name,
        description: page.description,
        url: `${this.siteUrl}${page.url}`,
        isPartOf: { '@id': `${this.siteUrl}/#website` },
        publisher: { '@id': `${this.siteUrl}/#organization` },
        inLanguage: 'en-US',
      },
      'json-ld-page'
    );
  }

  clearPageStructuredData(): void {
    this.removeStructuredData('json-ld-page');
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
      imageUrl: article.imageUrl || undefined,
      imageAlt: article.title,
      type: 'article',
      author: article.authors?.join(', ') || article.sourceName,
      publishedTime: article.publishedAt,
      section: article.topics?.[0],
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
      'image': article.imageUrl ? [article.imageUrl] : [this.defaultImage],
      'datePublished': article.publishedAt,
      'dateModified': article.publishedAt,
      'author': {
        '@type': 'Person',
        'name': article.authors?.length ? article.authors[0] : article.sourceName,
      },
      'publisher': {
        '@type': 'NewsMediaOrganization',
        'name': article.sourceName || SITE_NAME,
        'url': this.siteUrl,
        'logo': {
          '@type': 'ImageObject',
          'url': `${this.siteUrl}/icons/icon-512x512.png`,
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
    this.removeStructuredData('json-ld-article-schema');
  }
}
