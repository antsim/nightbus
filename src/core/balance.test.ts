import { describe, expect, it } from 'vitest';
import type { RunState } from './runState';
import { idleBot, reactiveBot, rhythmBot, runBot, sleptBeforeHome, type Bot } from './testing/bots';

// Balance metrics: targets for difficulty, not truths. If one breaks after
// tuning, adjust balance.ts first; change a limit only on purpose.

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Share of seeds where `bot`'s run satisfies `pass`. */
function share(bot: Bot, pass: (state: RunState) => boolean): number {
  return SEEDS.map((seed) => runBot(bot, { seed })).filter(pass).length / SEEDS.length;
}

const slept = (s: RunState) => s.drowsiness.microsleeps > 0;

describe('balance metrics (20 seeds)', () => {
  it('pressing on a steady beat fails: rhythm(400) has a microsleep in ≥ 80 %', () => {
    expect(share(rhythmBot(400), slept)).toBeGreaterThanOrEqual(0.8);
  });

  it('an attentive player succeeds: reactive(0.55, 400) has no microsleep in ≥ 70 %', () => {
    expect(share(reactiveBot(0.55, 400), (s) => !slept(s))).toBeGreaterThanOrEqual(0.7);
  });

  it('doing nothing fails: idle falls asleep before the home stop in 100 %', () => {
    expect(share(idleBot(), (s) => sleptBeforeHome(s))).toBe(1);
  });
});
