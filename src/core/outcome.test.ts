import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { resolveOutcome } from './outcome';
import { homeStop } from './route';
import { GameSession } from './session';
import { attentiveBot, defaultRoute as route, driveBot, runBot } from './testing/bots';

const STEP = BALANCE.time.stepMs;
const homeIndex = route.stops.findIndex((s) => s.isHome);
const idAt = (i: number) => route.stops[i]!.id;

describe('resolveOutcome', () => {
  it('home', () => expect(resolveOutcome(route, homeStop(route).id)).toEqual({ kind: 'home' }));
  it('tooEarly counts stops', () => expect(resolveOutcome(route, idAt(homeIndex - 3))).toEqual({ kind: 'tooEarly', stops: 3 }));
  it('overshot counts stops', () => expect(resolveOutcome(route, idAt(homeIndex + 2))).toEqual({ kind: 'overshot', stops: 2 }));
  it('terminus', () =>
    expect(resolveOutcome(route, idAt(route.stops.length - 1))).toEqual({
      kind: 'terminus',
      stops: route.stops.length - 1 - homeIndex,
    }));
  it('rejects unknown stops', () => expect(() => resolveOutcome(route, 'nope')).toThrow());
  it('sick before home', () =>
    expect(resolveOutcome(route, idAt(homeIndex - 2), true)).toEqual({ kind: 'sick', stops: 2, early: true }));
  it('sick past home, even at the terminus', () =>
    expect(resolveOutcome(route, idAt(route.stops.length - 1), true)).toEqual({
      kind: 'sick',
      stops: route.stops.length - 1 - homeIndex,
      early: false,
    }));
  it('sick at home is still home', () => expect(resolveOutcome(route, homeStop(route).id, true)).toEqual({ kind: 'home' }));
});

/** Plays awake and presses the stop button once the bus has left `afterStopIndex`. */
function playAndRequestAfter(afterStopIndex: number | null, seed = 1) {
  return runBot(attentiveBot(), afterStopIndex === null ? { seed } : { seed, stopAt: afterStopIndex });
}

describe('stop button and outcomes in play', () => {
  it('gets off at home when pressed after the previous stop', () => {
    const s = playAndRequestAfter(homeIndex - 1);
    expect(s.outcome).toEqual({ kind: 'home' });
    expect(s.alight?.stopId).toBe(homeStop(route).id);
    expect(s.alight?.lat).toBe(homeStop(route).lat);
    expect(s.log.some((e) => e.type === 'alighted')).toBe(true);
  });

  it('too early', () => {
    expect(playAndRequestAfter(homeIndex - 3).outcome).toEqual({ kind: 'tooEarly', stops: 2 });
  });

  it('overshot', () => {
    expect(playAndRequestAfter(homeIndex + 1)?.outcome).toEqual({ kind: 'overshot', stops: 2 });
  });

  it('terminus when never pressed', () => {
    const s = playAndRequestAfter(null);
    expect(s.outcome?.kind).toBe('terminus');
    expect(s.alight?.stopIndex).toBe(route.stops.length - 1);
  });

  it('ends the run: no further time passes', () => {
    const s = driveBot(GameSession.start({ seed: 1 }, route), attentiveBot(), { stopAt: homeIndex - 1 });
    const t = s.state.clock.minutes;
    for (let i = 0; i < 50; i++) s.step(STEP);
    expect(s.state.clock.minutes).toBe(t);
  });

  it('request is a state that resets when the bus stops', () => {
    const s = GameSession.start({ seed: 1 }, route);
    while (s.state.ride.phase === 'dwelling') s.step(STEP);
    s.handleInput('requestStop');
    expect(s.state.stopRequested).toBe(true);
    s.handleInput('requestStop'); // second press is ignored
    expect(s.state.log.filter((e) => e.type === 'stopRequested')).toHaveLength(1);
    driveBot(s, attentiveBot());
    expect(s.state.stopRequested).toBe(false);
    expect(s.outcome).toEqual({ kind: 'tooEarly', stops: homeIndex - 1 });
  });

  it('does nothing during a microsleep', () => {
    const s = GameSession.start({ seed: 7, fatigue: 0.95 }, route);
    while (s.state.drowsiness.phase !== 'asleep') s.step(STEP);
    s.handleInput('requestStop');
    expect(s.state.stopRequested).toBe(false);
  });

  it('a request is lost if the bus stops while you sleep', () => {
    const s = GameSession.start({ seed: 7, fatigue: 0.95 }, route);
    while (s.state.ride.phase === 'dwelling') s.step(STEP);
    s.handleInput('requestStop');
    while (s.state.drowsiness.microsleeps === 0 && !s.finished) s.step(STEP);
    const missed = s.state.log.filter((e) => e.type === 'stopMissedWhileAsleep');
    if (missed.length > 0) {
      expect(s.state.stopRequested).toBe(false);
      expect(s.state.alight).toBeNull();
    }
  });
});

describe('nausea limit', () => {
  /** Starts a ride and steps until the bus has left stop `index`. */
  const leaving = (index: number) => {
    const s = GameSession.start({ seed: 2 }, route);
    s.addModifier({ id: 'test-no-nausea', meter: 'nausea', ratePerMin: -1 });
    driveBot(s, attentiveBot(), { maxMs: 10 * 60_000, until: (st) => st.ride.stopIndex === index && st.ride.phase !== 'dwelling' });
    s.state.modifiers = [];
    return s;
  };
  /** Nausea at the limit with the eyes open, so this step pushes it over. */
  const atLimit = (s: GameSession) => {
    s.setMeter('nausea', 1);
    s.state.drowsiness = { ...s.state.drowsiness, eyelid: 0 };
  };

  it('forces a stop request at the next stop, logged once, that cannot be cancelled', () => {
    const s = leaving(1);
    const critical: unknown[] = [];
    s.bus.on('nauseaCritical', (e) => critical.push(e));
    atLimit(s);
    s.step(STEP);
    expect(s.state.sick).toBe(true);
    expect(s.state.stopRequested).toBe(true);
    s.handleInput('requestStop');
    for (let i = 0; i < 5; i++) s.step(STEP);
    expect(critical).toHaveLength(1);
    expect(s.state.log.filter((e) => e.type === 'nauseaCritical')).toHaveLength(1);
    expect(s.state.log.filter((e) => e.type === 'stopRequested')).toHaveLength(0);

    driveBot(s, attentiveBot());
    expect(s.state.alight?.stopIndex).toBe(2);
    expect(s.outcome).toEqual({ kind: 'sick', stops: homeIndex - 2, early: true });
  });

  it('gets the player off even if they fall asleep before the stop', () => {
    const s = leaving(1);
    atLimit(s);
    s.step(STEP);
    // Eyes shut long enough: the next step is a microsleep that passes the stop.
    s.state.drowsiness = { ...s.state.drowsiness, eyelid: 1, closedMs: BALANCE.sleep.graceMs };
    s.step(STEP);
    expect(s.state.drowsiness.microsleeps).toBe(1);
    expect(s.state.alight?.stopIndex).toBe(2);
    expect(s.outcome?.kind).toBe('sick');
    expect(s.state.log.some((e) => e.type === 'stopMissedWhileAsleep')).toBe(false);
  });

  it('a forced stop at the home stop is a lucky home', () => {
    const s = leaving(homeIndex - 1);
    atLimit(s);
    driveBot(s, attentiveBot());
    expect(s.state.sick).toBe(true);
    expect(s.outcome).toEqual({ kind: 'home' });
  });
});

describe('announcements', () => {
  it('announces every stop with a garble level from intoxication', () => {
    const sober = GameSession.start({ seed: 1, intoxication: 0.1, timeScale: 6 }, route);
    const drunk = GameSession.start({ seed: 1, intoxication: 0.95, timeScale: 6 }, route);
    const levels = { sober: [] as number[], drunk: [] as number[] };
    sober.bus.on('announcement', (a) => levels.sober.push(a.level));
    drunk.bus.on('announcement', (a) => levels.drunk.push(a.level));
    driveBot(sober, attentiveBot(), { maxMs: 40_000 });
    driveBot(drunk, attentiveBot(), { maxMs: 40_000 });
    expect(levels.sober.length).toBeGreaterThan(3);
    expect(levels.drunk[0]!).toBeGreaterThan(levels.sober[0]! + 0.3);
    expect(sober.state.announcement?.stopName).toBeTruthy();
  });
});
