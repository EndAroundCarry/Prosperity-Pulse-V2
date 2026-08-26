import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

/**
 * Real 404 page.
 *
 * The wildcard route previously redirected to `/`, which makes every mistyped
 * or stale URL return the homepage with a 200 — a "soft 404". Search engines
 * flag those and waste crawl budget on them. This page is explicitly
 * `noindex, nofollow` instead.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <main class="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <p class="text-6xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 sm:text-7xl">404</p>

      <h1 class="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        We couldn't find that page
      </h1>

      <p class="mt-3 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        The link may be out of date, or the page may have moved. Everything below is still here.
      </p>

      <nav class="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Suggested pages">
        @for (link of links; track link.path) {
          <a
            [routerLink]="link.path"
            class="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700
                   transition-colors hover:border-blue-400 hover:text-blue-700
                   dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-blue-400">
            {{ link.label }}
          </a>
        }
      </nav>

      <p class="mt-8 text-xs text-slate-400 dark:text-slate-500">
        Looking for a specific company? Press
        <kbd class="rounded border border-slate-300 px-1.5 py-0.5 font-medium dark:border-slate-600">Ctrl</kbd>
        +
        <kbd class="rounded border border-slate-300 px-1.5 py-0.5 font-medium dark:border-slate-600">K</kbd>
        to search every listed US symbol.
      </p>
    </main>
  `,
})
export class NotFoundComponent implements OnInit {
  private readonly seoService = inject(SeoService);

  readonly links = [
    { path: '/', label: 'Market Dashboard' },
    { path: '/news-feed', label: 'News Feed' },
    { path: '/calendar', label: 'Calendar' },
    { path: '/macro', label: 'Macro' },
    { path: '/about-data', label: 'About our data' },
  ];

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: 'Page Not Found',
      description: 'The page you requested could not be found on Prosperity Pulse.',
      robots: 'noindex',
    });
    this.seoService.clearBreadcrumbs();
    this.seoService.clearPageStructuredData();
  }
}
