import { searchSymbols, SymbolEntry } from './symbol-universe.service';

const entries: SymbolEntry[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
];

describe('searchSymbols', () => {
  it('ranks exact symbol match first and caps results', () => {
    const rows = searchSymbols(entries, 'aapl');
    expect(rows[0].symbol).toBe('AAPL');
    expect(rows.length).toBe(1);
  });

  it('matches by company-name substring when the symbol does not match', () => {
    const rows = searchSymbols(entries, 'micro');
    expect(rows.map((r) => r.symbol)).toEqual(['MSFT']);
  });

  it('returns empty for a blank term', () => {
    expect(searchSymbols(entries, '  ')).toEqual([]);
  });
});
