import { describe, expect, it } from 'vitest';
import { createRng, rngFrom } from './rng';

const sample = (seed: number, n = 20) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(sample(42)).toEqual(sample(42));
  });

  it('gives different sequences for different seeds', () => {
    expect(sample(1)).not.toEqual(sample(2));
  });

  it('stays within ranges', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const r = rng.range(2, 5);
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThan(5);
      const n = rng.int(1, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it('picks every element eventually', () => {
    const rng = createRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(rng.pick(['a', 'b', 'c']));
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
  });

  it('throws on picking from an empty array', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });

  it('continues the sequence from a stored state', () => {
    const holder = { rngState: 99 };
    const rng = rngFrom(holder);
    rng.next();
    const resumed = rngFrom({ rngState: holder.rngState });
    expect(resumed.next()).toBe(rng.next());
  });
});
