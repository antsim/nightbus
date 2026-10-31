import { describe, expect, it } from 'vitest';
import { advanceClock, createClock, formatTime, parseTime } from './clock';

describe('clock', () => {
  it('parses HH:MM', () => {
    expect(parseTime('02:10')).toBe(130);
    expect(parseTime('0:05')).toBe(5);
    expect(() => parseTime('25:00')).toThrow();
    expect(() => parseTime('nope')).toThrow();
  });

  it('formats with zero padding and floors partial minutes', () => {
    expect(formatTime(130)).toBe('02:10');
    expect(formatTime(130.99)).toBe('02:10');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(189.9999999)).toBe('03:10');
  });

  it('wraps past midnight', () => {
    expect(formatTime(24 * 60 + 15)).toBe('00:15');
    expect(formatTime(-10)).toBe('23:50');
  });

  it('advances by timeScale game minutes per real second', () => {
    const clock = createClock('02:10', 6);
    const later = advanceClock(clock, 10_000);
    expect(later.minutes).toBeCloseTo(130 + 60);
    expect(formatTime(later.minutes)).toBe('03:10');
    expect(clock.minutes).toBe(130);
  });
});
