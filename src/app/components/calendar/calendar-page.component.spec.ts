import { groupEarningsByDay } from './calendar-page.component';
import { EarningsEvent } from '../../models/instrument.model';

const e = (symbol: string, reportDate: string): EarningsEvent => ({
  symbol, name: '', reportDate, fiscalDateEnding: reportDate, estimate: null, currency: 'USD',
});

describe('groupEarningsByDay', () => {
  it('groups events by date in chronological order', () => {
    const days = groupEarningsByDay([e('B', '2026-09-02'), e('A', '2026-09-01'), e('C', '2026-09-01')], false, []);
    expect(days.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02']);
    expect(days[0].events.map((x) => x.symbol)).toEqual(['A', 'C']);
  });

  it('filters to the watchlist when requested', () => {
    const days = groupEarningsByDay([e('AAPL', '2026-09-01'), e('MSFT', '2026-09-01')], true, ['AAPL']);
    expect(days.length).toBe(1);
    expect(days[0].events[0].symbol).toBe('AAPL');
  });
});
