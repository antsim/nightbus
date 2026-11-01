import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { createDrowsiness, isFlustered, jolt, openEyes, updateEyes, type DrowsinessState } from './drowsiness';
import { valueNoise1D } from './noise';
import { createRng } from './rng';
import { stopsBetween } from './route';
import { GameSession } from './session';
import { attentiveBot, defaultRoute as route, driveBot, idleBot, reactiveBot, runBot } from './testing/bots';

const STEP = BALANCE.time.stepMs;
const INPUT = BALANCE.eyes.input;

/** Runs eyes-only simulation for `seconds` at constant fatigue without input. */
function simulateEyes(fatigue: number, seconds: number, seed = 1) {
  const rng = createRng(seed);
  let s = createDrowsiness(rng, fatigue);
  const eyelids: number[] = [];
  let fellAsleepAt: number | null = null;
  for (let t = 0; t < seconds * 10; t++) {
    const res = updateEyes(s, 0.1, fatigue, rng, seed);
    s = res.state;
    eyelids.push(s.eyelid);
    if (res.fellAsleep && fellAsleepAt === null) fellAsleepAt = t / 10;
  }
  return { state: s, eyelids, fellAsleepAt };
}

/** Game minutes until the first microsleep with no input, or null. */
function minutesToMicrosleep(fatigue: number, seed: number): number | null {
  const state = runBot(idleBot(), { seed, fatigue, intoxication: 0.6 });
  const sleep = state.log.find((e) => e.type === 'microsleep');
  return sleep ? sleep.time : null;
}

describe('valueNoise1D', () => {
  it('is deterministic, bounded and continuous', () => {
    for (let x = 0; x < 20; x += 0.01) {
      const v = valueNoise1D(5, x);
      expect(v).toBe(valueNoise1D(5, x));
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise1D(5, x + 0.01) - v)).toBeLessThan(0.1);
    }
  });
});

describe('eyelids', () => {
  it('stay within 0..1', () => {
    for (const fatigue of [0, 0.5, 1]) {
      for (const e of simulateEyes(fatigue, 120).eyelids) {
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    }
  });

  it('close in waves rather than steadily', () => {
    const { eyelids, state } = simulateEyes(0.3, 60);
    expect(state.waveCount).toBeGreaterThanOrEqual(5);
    // Rises and falls repeatedly (hysteresis between two levels), not a monotonic slide.
    let closings = 0;
    let high = false;
    for (const e of eyelids) {
      if (!high && e > 0.3) {
        high = true;
        closings++;
      } else if (high && e < 0.15) {
        high = false;
      }
    }
    expect(closings).toBeGreaterThanOrEqual(3);
  });

  it('close more when tired', () => {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(simulateEyes(0.8, 60).eyelids)).toBeGreaterThan(avg(simulateEyes(0.2, 60).eyelids));
  });

  it('wave timing is not periodic', () => {
    const rng = createRng(3);
    let s = createDrowsiness(rng, 0.5);
    const starts: number[] = [];
    for (let t = 0; t < 1200; t++) {
      const res = updateEyes(s, 0.1, 0.5, rng, 3);
      if (res.waveStarted) starts.push(t);
      s = res.state;
    }
    const gaps = starts.slice(1).map((v, i) => v - starts[i]!);
    expect(new Set(gaps).size).toBeGreaterThan(3);
  });
});

describe('player input', () => {
  const closing = (eyelid: number): DrowsinessState => ({ ...createDrowsiness(createRng(1), 0.5), eyelid });

  it('opens the eyes', () => {
    expect(openEyes(closing(0.8), 1000).eyelid).toBeCloseTo(0.8 - BALANCE.eyes.input.openAmount);
  });

  it('mashing is less effective', () => {
    const first = openEyes(closing(0.9), 1000);
    const mashed = openEyes({ ...first, eyelid: 0.9 }, 1000 + BALANCE.eyes.input.spamWindowMs / 2);
    const patient = openEyes({ ...first, eyelid: 0.9 }, 1000 + BALANCE.eyes.input.spamWindowMs * 2);
    expect(mashed.eyelid).toBeGreaterThan(patient.eyelid);
  });

  it('opening resets the press effect and keeps the startle count', () => {
    const s = openEyes(closing(0.8), 1000);
    expect(s.lastPress).toBe('opened');
    expect(s.startles).toBe(0);
    expect(openEyes({ ...s, eyelid: 0.9 }, 1100).lastPress).toBe('mashed');
  });

  describe('too early a press startles', () => {
    const early = INPUT.halfClosedThreshold - 0.1;

    it('closes the eyes a bit instead of opening them', () => {
      const s = openEyes(closing(early), 1000);
      expect(s.eyelid).toBeCloseTo(early + INPUT.earlyPressPenalty);
      expect(s.lastPress).toBe('startled');
      expect(s.startles).toBe(1);
    });

    it('brings the next wave sooner', () => {
      const before = { ...closing(early), wave: null, nextWaveInSec: 4 };
      expect(openEyes(before, 0).nextWaveInSec).toBeCloseTo(4 - INPUT.earlyPressWaveAdvanceSec);
      expect(openEyes({ ...before, nextWaveInSec: 1 }, 0).nextWaveInSec).toBe(0);
    });

    it('deepens a running wave instead', () => {
      const wave = { elapsedSec: 1, durationSec: 4, depth: 0.5 };
      const s = openEyes({ ...closing(early), wave, nextWaveInSec: 4 }, 0);
      expect(s.wave?.depth).toBeCloseTo(0.5 + INPUT.earlyPressWaveDepthBoost);
      expect(s.nextWaveInSec).toBe(4);
    });

    it('is not affected by the anti-mashing window, nor does it start one', () => {
      const opened = openEyes(closing(0.9), 1000);
      expect(openEyes({ ...opened, eyelid: early }, 1050).eyelid).toBeCloseTo(early + INPUT.earlyPressPenalty);
      const startled = openEyes({ ...closing(early), lastInputMs: null }, 1000);
      expect(startled.lastInputMs).toBeNull();
      expect(openEyes({ ...startled, eyelid: 0.8 }, 1050).eyelid).toBeCloseTo(0.8 - INPUT.openAmount);
    });

    it('a single startle is forgiven, repeated ones fluster the player', () => {
      let s = openEyes(closing(early), 0);
      expect(isFlustered(s)).toBe(false);
      expect(openEyes({ ...s, eyelid: 0.8 }, 500).lastPress).toBe('opened');
      for (let i = 0; i < 2; i++) s = openEyes({ ...s, eyelid: early }, 0);
      expect(isFlustered(s)).toBe(true);
      // While flustered even a well-timed press startles.
      expect(openEyes({ ...s, eyelid: 0.8 }, 5000).lastPress).toBe('startled');
    });

    it('calming down takes a few seconds without pressing', () => {
      let s: DrowsinessState = { ...closing(0), jumpiness: INPUT.jumpinessMax };
      const rng = createRng(1);
      const calmSec = (INPUT.jumpinessMax - 1) / INPUT.jumpinessDecayPerSec;
      for (let t = 0; t < calmSec * 10 + 1; t++) s = updateEyes(s, 0.1, 0.5, rng, 1).state;
      expect(isFlustered(s)).toBe(false);
    });
  });

  it('a jolt opens the eyes a bit', () => {
    expect(jolt(closing(0.5), 0.2).eyelid).toBeCloseTo(0.3);
  });

  it('a faint jolt does not interrupt falling asleep', () => {
    expect(jolt({ ...closing(1), closedMs: 800 }, BALANCE.wakers.streetLightJolt).closedMs).toBe(800);
  });

  it('a startle is emitted and logged for the report', () => {
    const session = GameSession.start({ seed: 1 }, route);
    const seen: number[] = [];
    session.bus.on('startled', ({ eyelid }) => seen.push(eyelid));
    session.state.drowsiness = { ...session.state.drowsiness, eyelid: 0.2 };
    session.handleInput('openEyes');
    expect(seen).toEqual([expect.closeTo(0.2 + INPUT.earlyPressPenalty)]);
    expect(session.state.log.filter((e) => e.type === 'startled')).toHaveLength(1);
    session.state.drowsiness = { ...session.state.drowsiness, eyelid: 0.8 };
    session.handleInput('openEyes');
    expect(seen).toHaveLength(1);
  });

  it('is ignored while asleep', () => {
    const asleep = { ...closing(1), phase: 'asleep' as const };
    expect(openEyes(asleep, 0)).toBe(asleep);
  });

  it('an attentive player can keep the eyes open for the whole ride', () => {
    for (const seed of [1, 2, 3]) {
      const state = runBot(attentiveBot(), { seed });
      expect(state.ride.phase).toBe('finished');
      expect(state.drowsiness.microsleeps).toBe(0);
      // Ride length in 3–4 minutes when awake (all real time was spent awake).
      expect(state.drowsiness.elapsedMs / 60_000).toBeGreaterThan(3);
      expect(state.drowsiness.elapsedMs / 60_000).toBeLessThan(4);
    }
  });

  it('a sluggish player sometimes drifts off', () => {
    const sleeps = [1, 2, 3, 4, 5].map((seed) => runBot(reactiveBot(0.9, 1500), { seed }).drowsiness.microsleeps);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

describe('microsleep', () => {
  it('happens sooner with higher starting fatigue (same seed, no input)', () => {
    for (const seed of [1, 2, 3]) {
      const rested = minutesToMicrosleep(0.3, seed);
      const tired = minutesToMicrosleep(0.8, seed);
      expect(tired).not.toBeNull();
      expect(rested === null || tired! < rested).toBe(true);
    }
  });

  it('jumps time forward and logs the stops passed while asleep', () => {
    const session = GameSession.start({ seed: 7, fatigue: 0.9 }, route);
    let before = { minutes: 0, offset: 0 };
    while (session.state.drowsiness.microsleeps === 0) {
      before = { minutes: session.state.clock.minutes, offset: session.state.ride.offsetSec };
      session.step(STEP);
    }
    const sleep = session.state.log.find((e) => e.type === 'microsleep');
    expect(sleep?.type).toBe('microsleep');
    if (sleep?.type !== 'microsleep') return;

    const jumped = session.state.clock.minutes - before.minutes;
    expect(jumped).toBeGreaterThanOrEqual(BALANCE.sleep.minMinutes);
    expect(jumped).toBeLessThanOrEqual(BALANCE.sleep.maxMinutes + 0.1);
    expect(sleep.data.durationMin).toBeCloseTo(jumped, 1);
    expect(session.state.ride.offsetSec).toBeGreaterThan(before.offset);

    // Every stop the bus reached during the skip is logged as missed.
    const passed = stopsBetween(route, before.offset, session.state.ride.offsetSec).map((s) => s.id);
    const missed = session.state.log.filter((e) => e.type === 'stopMissedWhileAsleep').map((e) => e.data.stopId);
    expect(missed).toEqual(passed);
    expect(sleep.data.stopsMissed).toEqual(passed);
    expect(passed.length).toBeGreaterThan(0);
  });

  it('blacks out, ignores input, then wakes up confused', () => {
    const session = GameSession.start({ seed: 7, fatigue: 0.9 }, route);
    const woke: number[] = [];
    session.bus.on('wokeUp', () => woke.push(1));
    while (session.state.drowsiness.phase !== 'asleep') session.step(STEP);

    const frozen = session.state.clock.minutes;
    session.handleInput('openEyes');
    expect(session.state.drowsiness.eyelid).toBe(1);
    for (let ms = 0; ms < BALANCE.sleep.blackoutMs - STEP; ms += STEP) session.step(STEP);
    expect(session.state.clock.minutes).toBe(frozen);
    expect(session.state.drowsiness.phase).toBe('asleep');

    session.step(STEP);
    session.step(STEP);
    expect(session.state.drowsiness.phase).toBe('awake');
    expect(session.state.drowsiness.confusedMs).toBeGreaterThan(0);
    expect(woke).toHaveLength(1);
  });

  it('is reproducible for the same seed', () => {
    const run = () => {
      const s = GameSession.start({ seed: 11, fatigue: 0.8 }, route);
      for (let i = 0; i < 3000; i++) s.step(STEP);
      return JSON.stringify(s.state);
    };
    expect(run()).toBe(run());
  });
});

describe('wakers', () => {
  it('street lights and braking jolt the eyes open', () => {
    const session = GameSession.start({ seed: 1 }, route);
    const sources = new Set<string>();
    session.bus.on('jolt', ({ source }) => sources.add(source));
    let lights = 0;
    session.bus.on('streetLightPassed', () => lights++);
    driveBot(session, attentiveBot(), { maxMs: 60_000 });
    expect(sources).toEqual(new Set(['brake', 'streetLight']));
    expect(lights).toBeGreaterThan(5);
    expect(session.state.modifiers.some((m) => m.id === 'brake-jolt') || session.state.log.some((e) => e.type === 'modifierExpired')).toBe(true);
  });
});
