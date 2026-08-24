import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { WatchlistStripComponent } from './watchlist-strip.component';
import { WatchlistService } from '../../services/watchlist.service';
import { QuoteSnapshot } from '../../models/instrument.model';

const quote = (symbol: string, changePercent: number): QuoteSnapshot => ({
  symbol,
  name: symbol,
  assetClass: 'etf',
  price: 100,
  previousClose: 99,
  change: 1,
  changePercent,
  asOf: '2026-08-20',
  rangeLow: 90,
  rangeHigh: 110,
  sparkline: [],
});

class StubWatchlistService {
  readonly symbols = signal(['SPY', 'NOVA']);
  readonly isFull = signal(false);
  reorderCalls: string[][] = [];
  async reorder(list: string[]): Promise<void> {
    this.reorderCalls.push(list);
  }
}

describe('WatchlistStripComponent', () => {
  it('renders cached quotes and a queued hint for uncached symbols', () => {
    TestBed.configureTestingModule({
      imports: [WatchlistStripComponent],
      providers: [provideRouter([]), { provide: WatchlistService, useClass: StubWatchlistService }],
    });
    const fixture = TestBed.createComponent(WatchlistStripComponent);
    fixture.componentRef.setInput('quotes', [quote('SPY', 0.8)]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('SPY');
    expect(el.textContent).toContain('queued…'); // NOVA has no cached quote
  });

  it('drop() persists the new order through the service', () => {
    TestBed.configureTestingModule({
      imports: [WatchlistStripComponent],
      providers: [provideRouter([]), { provide: WatchlistService, useClass: StubWatchlistService }],
    });
    const fixture = TestBed.createComponent(WatchlistStripComponent);
    fixture.detectChanges();

    const stub = TestBed.inject(WatchlistService) as unknown as StubWatchlistService;
    fixture.componentInstance.drop({ previousIndex: 0, currentIndex: 1 } as never);
    expect(stub.reorderCalls).toEqual([['NOVA', 'SPY']]);
  });
});
