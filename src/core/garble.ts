import { BALANCE } from '../data/balance';
import { clamp } from './math';
import type { Rng } from './rng';

// Garbled bus announcements. Works on Finnish-ish syllables and garbles the
// start of words more than the end, because listeners catch word endings.

const VOWELS = new Set('aeiouyäöåAEIOUYÄÖÅ');
const isLetter = (ch: string) => /\p{L}/u.test(ch);
const isVowel = (ch: string) => VOWELS.has(ch);
const isConsonant = (ch: string) => isLetter(ch) && !isVowel(ch);

/** "kauppatori" → ["kaup", "pa", "to", "ri"]: a consonant before a vowel starts a new syllable. */
export function syllabify(word: string): string[] {
  const syllables: string[] = [];
  let current = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]!;
    const next = word[i + 1] ?? '';
    const hasVowel = [...current].some(isVowel);
    if (current && hasVowel && isConsonant(ch) && isVowel(next)) {
      syllables.push(current);
      current = '';
    }
    current += ch;
  }
  if (current) syllables.push(current);
  return syllables;
}

function garbleWord(word: string, level: number, rng: Rng): string {
  const g = BALANCE.announcements.garble;
  const syllables = syllabify(word);
  const n = syllables.length;

  // Whole word swallowed into a mumble, keeping only the tail.
  if (n > 2 && rng.next() < level * g.cutWordChance) {
    const keep = Math.max(1, Math.round(n * g.cutKeepShare));
    return '…' + syllables.slice(n - keep).join('');
  }

  const out = syllables.map((syl, j) => {
    // Position weight: 1 at the start of the word, endWeight at the end.
    const weight = n === 1 ? g.endWeight : 1 - (1 - g.endWeight) * (j / (n - 1));
    const p = clamp(level * weight, 0, 1);
    const roll = rng.next();
    if (roll < p * g.replaceShare) return rng.pick(g.fillers);
    if (roll < p) {
      // Drop a letter or two.
      let s = syl;
      const drops = rng.int(1, Math.max(1, Math.floor(s.length / 2)));
      for (let k = 0; k < drops && s.length > 1; k++) {
        const at = rng.int(0, s.length - 1);
        s = s.slice(0, at) + s.slice(at + 1);
      }
      return s;
    }
    return syl;
  });
  return out.join('');
}

/**
 * Garbles `text` by `level` (0 = clear, 1 = mostly mumble). Deterministic:
 * the same rng state, text and level always give the same result.
 */
export function garble(text: string, level: number, rng: Rng): string {
  if (level <= 0) return text;
  // Split into words and the separators between them, keeping punctuation.
  const parts = text.split(/(\p{L}+)/u);
  return parts.map((part) => (part && isLetter(part[0]!) ? garbleWord(part, level, rng) : part)).join('');
}

/** How garbled announcements are for the current state. */
export function garbleLevel(intoxication: number, fatigue: number): number {
  const a = BALANCE.announcements;
  return clamp(intoxication * a.intoxWeight + fatigue * a.fatigueWeight - a.clearBelow, 0, 1);
}
