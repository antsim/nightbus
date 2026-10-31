import { describe, expect, it } from 'vitest';
import { garble, garbleLevel, syllabify } from './garble';
import { createRng } from './rng';

const ANNOUNCEMENTS = [
  'Seuraava pysäkki: Kauppatori',
  'Seuraava pysäkki: Leinolan koulu',
  'Seuraava pysäkki: Sudenkorennontie',
  'Seuraava pysäkki: Ilmattarenkatu',
  'Seuraava pysäkki: Kaupin kampus E',
];

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[a.length]![b.length]!;
}

/** Average normalised edit distance over many announcements, same seeds for each level. */
function damage(level: number): number {
  let total = 0;
  let n = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const text of ANNOUNCEMENTS) {
      total += levenshtein(text, garble(text, level, createRng(seed))) / text.length;
      n++;
    }
  }
  return total / n;
}

describe('syllabify', () => {
  it.each([
    ['kauppatori', ['kaup', 'pa', 'to', 'ri']],
    ['seuraava', ['seu', 'raa', 'va']],
    ['pysäkki', ['py', 'säk', 'ki']],
    ['tays', ['tays']],
  ])('%s', (word, expected) => {
    expect(syllabify(word)).toEqual(expected);
  });
});

describe('garble', () => {
  it('leaves text untouched at level 0', () => {
    expect(garble(ANNOUNCEMENTS[0]!, 0, createRng(1))).toBe(ANNOUNCEMENTS[0]);
  });

  it('is reproducible: same seed, text and level give the same result', () => {
    const a = garble('Seuraava pysäkki: Kauppatori', 0.7, createRng(42));
    const b = garble('Seuraava pysäkki: Kauppatori', 0.7, createRng(42));
    expect(a).toBe(b);
  });

  it('garbles clearly more at higher levels (three levels, same seeds)', () => {
    const low = damage(0.2);
    const mid = damage(0.5);
    const high = damage(0.9);
    expect(low).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(low * 1.5);
    expect(high).toBeGreaterThan(mid * 1.3);
  });

  it('keeps word endings more often than beginnings', () => {
    let startKept = 0;
    let endKept = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const out = garble('Kauppatori', 0.6, createRng(seed));
      if (out.startsWith('Kaup')) startKept++;
      if (out.endsWith('ri')) endKept++;
    }
    expect(endKept).toBeGreaterThan(startKept);
  });

  it('keeps punctuation and spacing structure', () => {
    const out = garble('Seuraava pysäkki: Kauppatori', 0.5, createRng(3));
    expect(out).toContain(': ');
  });
});

describe('garbleLevel', () => {
  it('rises with intoxication and fatigue and stays in 0..1', () => {
    expect(garbleLevel(0, 0)).toBe(0);
    expect(garbleLevel(0.9, 0.5)).toBeGreaterThan(garbleLevel(0.3, 0.5));
    expect(garbleLevel(1, 1)).toBeLessThanOrEqual(1);
  });
});
