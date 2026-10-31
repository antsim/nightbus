import { describe, expect, it } from 'vitest';
import { formatEuros } from './money';

describe('formatEuros', () => {
  it('formats cents as euros', () => {
    expect(formatEuros(2500)).toBe('25,00 €');
    expect(formatEuros(5)).toBe('0,05 €');
    expect(formatEuros(-150)).toBe('-1,50 €');
  });
});
