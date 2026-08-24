import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TickerHeaderComponent } from './ticker-header.component';
import { Candle, FundamentalsDoc } from '../../models/instrument.model';

const candles: Candle[] = [
  { date: '2026-08-19', open: 99, high: 101, low: 98, close: 100, volume: 1_000 },
  { date: '2026-08-20', open: 100, high: 104, low: 99.5, close: 103, volume: 2_000 },
];

describe('TickerHeaderComponent', () => {
  let fixture: ComponentFixture<TickerHeaderComponent>;

  function create(inputs: Record<string, unknown>): void {
    TestBed.configureTestingModule({ imports: [TickerHeaderComponent] });
    const cmp = TestBed.createComponent(TickerHeaderComponent);
    for (const [key, value] of Object.entries(inputs)) {
      cmp.componentRef.setInput(key, value);
    }
    fixture = cmp;
    fixture.detectChanges();
  }

  it('shows the queued notice when there is no cached data', () => {
    create({ symbol: 'XYZ', candles: null });
    expect(fixture.nativeElement.textContent).toContain('Price data queued');
  });

  it('renders last close with change and watchlist toggle emits state', () => {
    create({ symbol: 'AAPL', candles });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('103');
    expect(el.textContent).toContain('+3.00');
    const emitted: boolean[] = [];
    fixture.componentInstance.toggle.subscribe((v) => emitted.push(v));
    (el.querySelector('button[type="button"]') as HTMLButtonElement).click();
    expect(emitted).toEqual([true]);
  });
});
