import { describe, expect, it } from 'vitest';
import { clamp } from './math';

describe('clamp', () => {
  it('keeps values inside the range unchanged', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('clamps to the bounds', () => {
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(3, 0, 1)).toBe(1);
  });
});
