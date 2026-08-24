import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { MarketDataService } from '../../services/market-data.service';
import { QuoteSnapshot } from '../../models/instrument.model';

const quote = (symbol: string): QuoteSnapshot => ({
  symbol,
  name: symbol,
  assetClass: 'etf',
  price: 100,
  previousClose: 99,
  change: 1,
  changePercent: 1,
  asOf: '2026-08-20',
  rangeLow: 90,
  rangeHigh: 110,
  sparkline: [95, 98, 100],
});

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: MarketDataService,
          useValue: {
            getDashboardSnapshot: () =>
              of({ updatedAt: '2026-08-20T21:00:00Z', quotes: [quote('SPY'), quote('XLK')] }),
            getMovers: () => of(null),
            getMacro: () => of(null),
            getEarningsCalendar: () => of(null),
            getIpoCalendar: () => of(null),
            getTopNews: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  });

  it('renders the market status strip and index tiles from the snapshot', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('pp-market-status-strip')).toBeTruthy();
    expect(el.querySelector('pp-index-row-widget')?.textContent).toContain('SPY');
    expect(el.querySelector('pp-sector-heatmap-widget')).toBeTruthy();
  });
});
