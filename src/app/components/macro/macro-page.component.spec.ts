import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MacroPageComponent } from './macro-page.component';
import { MarketDataService } from '../../services/market-data.service';
import { MacroSeries } from '../../models/instrument.model';

const cpi: MacroSeries = {
  id: 'cpi', name: 'CPI', unit: '', interval: 'monthly',
  points: [{ date: '2026-07-01', value: 320.5 }, { date: '2026-06-01', value: 319.8 }],
};

describe('MacroPageComponent', () => {
  let fixture: ComponentFixture<MacroPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MacroPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: MarketDataService,
          useValue: {
            getMacro: (id: string) => of(id === 'cpi' ? cpi : null),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MacroPageComponent);
    fixture.detectChanges();
  });

  it('renders each indicator with its latest value and plain-English note', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('320.5'); // latest CPI print
    expect(el.textContent).toContain('prior 319.8');
    expect(el.querySelectorAll('pp-widget-card').length).toBeGreaterThanOrEqual(5);
  });
});
