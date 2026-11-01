import { describe, expect, it } from 'vitest';
import type { RunState } from './runState';
import {
  defaultRoute,
  idleBot,
  nauseaAwareBot,
  reactiveBot,
  rhythmBot,
  runBot,
  sleptBeforeHome,
  type Bot,
  type RunBotOptions,
} from './testing/bots';

// Balance metrics: targets for difficulty, not truths. If one breaks after
// tuning, adjust balance.ts first; change a limit only on purpose.

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Share of seeds where `bot`'s run satisfies `pass`. */
function share(bot: Bot, pass: (state: RunState) => boolean, opts: Omit<RunBotOptions, 'seed'> = {}): number {
  return SEEDS.map((seed) => runBot(bot, { seed, ...opts })).filter(pass).length / SEEDS.length;
}

/** Requests the stop right after the stop before home, i.e. plays the route correctly. */
const headingHome = { stopAt: defaultRoute.stops.findIndex((s) => s.isHome) - 1 };
const gotHome = (s: RunState) => s.outcome?.kind === 'home';

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

  it('eyes open all the way makes you sick: reactive(0.55, 400) fails to get home in ≥ 50 %', () => {
    expect(share(reactiveBot(0.55, 400), (s) => !gotHome(s), headingHome)).toBeGreaterThanOrEqual(0.5);
  });

  it('resting the eyes when nauseous works: nauseaAware gets home in ≥ 60 %', () => {
    expect(share(nauseaAwareBot(), gotHome, headingHome)).toBeGreaterThanOrEqual(0.6);
  });
});
