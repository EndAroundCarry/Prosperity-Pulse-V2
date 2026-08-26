import { Component, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../../services/seo.service';

interface DataSection {
  title: string;
  source: string;
  cadence: string;
  notes: string;
}

@Component({
  selector: 'app-about-data',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <header class="space-y-2">
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          About our data
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Where every number on this site comes from, how often it refreshes, and the
          limitations you should know about. We believe a financial portal owes its
          readers this page.
        </p>
      </header>

      <section
        class="rounded-3xl border border-amber-300/60 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/40 p-5 text-sm text-amber-900 dark:text-amber-200 space-y-1">
        <p class="font-bold flex items-center gap-2">
          <span aria-hidden="true">⚠</span> Nothing here is investment advice
        </p>
        <p class="leading-relaxed text-[13px]">
          All content is informational only, may be delayed or stale, and should not be
          used as the basis for any trading decision. Prices shown are end-of-day closes,
          not live quotes.
        </p>
      </section>

      <section class="space-y-4" aria-label="Data sources and refresh cadence">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Sources &amp; refresh cadence</h2>
        <div class="grid gap-3">
          @for (section of dataSections; track section.title) {
            <article
              class="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-1.5">
              <h3 class="font-bold text-slate-900 dark:text-slate-100 text-sm">{{ section.title }}</h3>
              <dl class="text-xs grid gap-x-6 gap-y-0.5 sm:grid-cols-[auto_1fr]">
                <dt class="font-semibold text-slate-500 dark:text-slate-400">Source</dt>
                <dd class="text-slate-600 dark:text-slate-300">{{ section.source }}</dd>
                <dt class="font-semibold text-slate-500 dark:text-slate-400">Refresh</dt>
                <dd class="text-slate-600 dark:text-slate-300">{{ section.cadence }}</dd>
                <dt class="font-semibold text-slate-500 dark:text-slate-400">Notes</dt>
                <dd class="text-slate-600 dark:text-slate-300">{{ section.notes }}</dd>
              </dl>
            </article>
          }
        </div>
      </section>

      <section
        class="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3"
        aria-label="Known limitations">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Known limitations</h2>
        <ul class="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <li>
            <strong>Index proxies:</strong> we cannot show the S&amp;P 500, Nasdaq 100, or Dow directly.
            Those index feeds are premium; SPY, QQQ, and DIA ETF prices are used as close-tracking proxies instead.
          </li>
          <li>
            <strong>Sector rotation staleness:</strong> under our free API budget the eleven sector tiles rotate on a
            roughly five-day cycle. Each tile shows an "as of" date — check it before assuming freshness.
          </li>
          <li>
            <strong>No intraday data:</strong> everything is end-of-day. A price shown twice in one day is not live.
          </li>
          <li>
            <strong>Macro releases lag:</strong> CPI, unemployment, and GDP are published monthly by their agencies;
            our refresh adds up to a week on top of that.
          </li>
          <li>
            <strong>Sentiment scores are algorithmic:</strong> news sentiment labels come from Alpha Vantage's
            automated model, not human analysis.
          </li>
        </ul>
      </section>

      <footer class="text-xs text-slate-400 dark:text-slate-500 pt-2">
        Questions? Data is fetched from the
        <a href="https://www.alphavantage.co" target="_blank" rel="noopener noreferrer"
          class="underline decoration-dotted hover:text-slate-600 dark:hover:text-slate-300">Alpha Vantage API</a>.
        See the
        <a routerLink="/news-feed" class="underline decoration-dotted hover:text-slate-600 dark:hover:text-slate-300">news feed</a>
        for what's currently flowing.
      </footer>
    </main>
  `,
})
export class AboutDataPageComponent implements OnInit {
  private readonly seoService = inject(SeoService);

  readonly dataSections: DataSection[] = [
    {
      title: 'Market news & sentiment',
      source: 'Alpha Vantage NEWS_SENTIMENT',
      cadence: 'Every ~6 hours',
      notes: 'Sentiment scores (−1 to +1) come from Alpha Vantage\'s model.',
    },
    {
      title: 'Stock & ETF prices',
      source: 'Alpha Vantage TIME_SERIES_DAILY',
      cadence: 'Once per trading day',
      notes: 'End-of-day closes only; no intraday ticks.',
    },
    {
      title: 'Index levels (S&P 500, Nasdaq 100, Dow)',
      source: 'SPY / QQQ / DIA ETF proxies',
      cadence: 'Daily',
      notes: 'Index feeds are premium-gated; ETFs track them closely but are not identical.',
    },
    {
      title: 'Sector performance',
      source: '11 SPDR sector ETFs',
      cadence: 'Rotating, ~5-day cycle',
      notes: 'Each tile carries its own "as of" date.',
    },
    {
      title: 'Top movers',
      source: 'Alpha Vantage TOP_GAINERS_LOSERS',
      cadence: 'Every ~12 hours',
      notes: 'Gainers, losers, and most active in one snapshot.',
    },
    {
      title: 'Treasury yields',
      source: 'Alpha Vantage TREASURY_YIELD',
      cadence: 'Daily (10y); weekly rotation (2y)',
      notes: 'Yield-curve spread computed from the two maturities.',
    },
    {
      title: 'Crypto',
      source: 'Alpha Vantage DIGITAL_CURRENCY_DAILY',
      cadence: 'Daily',
      notes: 'BTC daily; ETH rotates through the slower cycle.',
    },
    {
      title: 'Economic indicators (CPI, unemployment, fed funds, GDP, retail sales)',
      source: 'Alpha Vantage economic indicators',
      cadence: 'Weekly round-robin',
      notes: 'Underlying data itself publishes monthly or quarterly.',
    },
    {
      title: 'Earnings & IPO calendars',
      source: 'Alpha Vantage EARNINGS_CALENDAR / IPO_CALENDAR',
      cadence: 'Weekly',
      notes: '~3-month forward horizon.',
    },
  ];

  ngOnInit(): void {
    this.seoService.updateSeo({
      title: 'About Our Data — Sources, Refresh Cadence & Limitations',
      description:
        'How Prosperity Pulse sources market data from Alpha Vantage, how often each dataset refreshes, and the known limitations: ETF proxies, end-of-day pricing, sector rotation staleness.',
      keywords: 'data sources, alpha vantage, end-of-day data, etf proxies, refresh cadence, financial data limitations',
      url: '/about-data',
    });
    this.seoService.setBreadcrumbs([{ name: 'About our data', url: '/about-data' }]);
    this.seoService.setPageStructuredData({
      name: 'About our data',
      description:
        'Data sources, refresh cadence, and known limitations for every dataset shown on Prosperity Pulse.',
      url: '/about-data',
      type: 'AboutPage',
    });
  }
}
