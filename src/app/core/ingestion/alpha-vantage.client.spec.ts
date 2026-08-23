import { classifyResponse, parseCsv, AlphaVantageError } from './alpha-vantage.client';

describe('alpha vantage client response classification', () => {
  it('classifies a rate-limit Note', () => {
    const result = classifyResponse({ Note: 'Your API access frequency is restricted. Please wait 1 minute.' });
    expect('error' in result).toBeTrue();
    if ('error' in result) {
      expect(result.error.kind).toBe('rate-limited');
    }
  });

  it('classifies a premium-gated Information message', () => {
    const result = classifyResponse({
      Information: 'Thank you for using Alpha Vantage! This is a premium endpoint. Your API plan does not support it.',
    });
    expect('error' in result).toBeTrue();
    if ('error' in result) {
      const error = result.error as AlphaVantageError;
      expect(error.kind).toBe('premium-gated');
      expect(error.premiumPlan).toBeDefined();
    }
  });

  it('classifies a quota-exhaustion Information message as rate-limited', () => {
    const result = classifyResponse({
      Information: 'Thank you for using Alpha Vantage! Our standard API call frequency is 25 calls per day. You have reached this limit.',
    });
    expect('error' in result).toBeTrue();
    if ('error' in result) {
      expect(result.error.kind).toBe('rate-limited');
      expect(result.error.premiumPlan).toBeUndefined();
    }
  });

  it('classifies a bad-request Error Message', () => {
    const result = classifyResponse({ 'Error Message': 'Invalid API call. Please retry or visit documentation.' });
    expect('error' in result).toBeTrue();
    if ('error' in result) {
      expect(result.error.kind).toBe('bad-request');
    }
  });

  it('passes through a valid payload as data', () => {
    const result = classifyResponse({ feed: [{ title: 'x' }] });
    expect('data' in result).toBeTrue();
    if ('data' in result) {
      expect((result.data as { feed: unknown[] }).feed.length).toBe(1);
    }
  });
});

describe('alpha vantage CSV parser', () => {
  it('parses a simple header + rows', () => {
    const csv = 'symbol,name,exchange\nAAPL,Apple Inc,NASDAQ\nMSFT,Microsoft,NASDAQ';
    const rows = parseCsv(csv);
    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ' });
  });

  it('handles quoted fields with commas', () => {
    const csv = 'symbol,name\nAAPL,"Apple, Inc."';
    const rows = parseCsv(csv);
    expect(rows[0]['name']).toBe('Apple, Inc.');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const csv = 'symbol,note\nAAPL,"Say ""hi"""';
    const rows = parseCsv(csv);
    expect(rows[0]['note']).toBe('Say "hi"');
  });

  it('skips empty lines and malformed rows', () => {
    const csv = 'symbol,name\n\nAAPL,Apple\nBROKEN_ROW_NO_HEADER_MATCH';
    const rows = parseCsv(csv);
    expect(rows.length).toBe(1);
    expect(rows[0]['symbol']).toBe('AAPL');
  });
});
