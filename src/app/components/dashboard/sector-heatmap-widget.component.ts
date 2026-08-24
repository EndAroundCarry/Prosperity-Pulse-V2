import { Component, computed, inject, input } from '@angular/core';
import { QuoteSnapshot } from '../../models/instrument.model';
import { WidgetCardComponent } from '../../shared/components/widget-card.component';
import { SectorHeatmapComponent, SectorTile } from '../../shared/charts/sector-heatmap.component';
import { daysStale, asOfLabel } from '../../shared/dashboard.util';
import { ThemeService } from '../../core/theme.service';

/** Sector heatmap — 11 SPDR tiles with per-tile "as of" (5-day rotation). */
@Component({
  selector: 'pp-sector-heatmap-widget',
  standalone: true,
  imports: [WidgetCardComponent, SectorHeatmapComponent],
  template: `
    <pp-widget-card
      title="Sectors"
      [state]="state()"
      [asOf]="asOfLabel()"
      [staleDays]="staleDays()"
      info="SPDR sector ETFs on a rotating ~5-day refresh cycle — tiles show their own close dates."
      emptyMessage="Sector tiles arrive as the rotation works through the 11 sectors.">
      <pp-sector-heatmap [tiles]="tiles()" />
    </pp-widget-card>
  `,
})
export class SectorHeatmapWidgetComponent {
  readonly quotes = input<QuoteSnapshot[]>([]);
  readonly loading = input(false);
  readonly themeService = inject(ThemeService);

  readonly sectors = computed(() => this.quotes().filter((q) => q.symbol.startsWith('XL')));

  readonly tiles = computed<SectorTile[]>(() =>
    this.sectors().map((q) => ({ name: q.name, symbol: q.symbol, changePercent: q.changePercent }))
  );

  readonly state = computed(() => {
    if (this.loading()) return 'loading' as const;
    return this.sectors().length > 0 ? ('loaded' as const) : ('empty' as const);
  });

  readonly asOfLabel = computed(() => {
    const dates = this.sectors().map((q) => q.asOf).sort();
    const newest = dates[dates.length - 1];
    return newest ? asOfLabel(newest) : '';
  });

  readonly staleDays = computed(() => {
    const worst = Math.max(...this.sectors().map((q) => daysStale(q.asOf)), 0);
    return Number.isFinite(worst) ? worst : null;
  });
}
