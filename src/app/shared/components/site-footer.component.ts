import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <footer
      class="mt-auto border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md transition-colors">
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
            $
          </div>
          <span class="font-semibold text-slate-700 dark:text-slate-200">Prosperity Pulse</span>
          <span class="hidden sm:inline">— Financial intelligence portal</span>
        </div>

        <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-right">
          <p class="text-[11px] leading-snug max-w-md">
            Not investment advice · End-of-day data · Powered by
            <a href="https://www.alphavantage.co" target="_blank" rel="noopener noreferrer"
              class="underline decoration-dotted hover:text-slate-700 dark:hover:text-slate-200">Alpha Vantage</a>
          </p>
          <a routerLink="/about-data"
            class="underline decoration-dotted hover:text-slate-700 dark:hover:text-slate-200 font-medium whitespace-nowrap">
            About our data
          </a>
          <span>© {{ currentYear }} Prosperity Pulse</span>
        </div>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  readonly currentYear = new Date().getFullYear();
}
