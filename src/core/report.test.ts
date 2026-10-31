import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { REPORT_LINES } from '../data/reportLines.fi';
import routeData from '../data/routes/bus-nro6.json';
import { loadBest, saveIfBest, type KeyValueStorage } from '../services/bestScore';
import { buildReport, pickLines, receiptNumber, type ReportFacts } from './report';
import { parseRoute } from './route';
import { GameSession } from './session';

const route = parseRoute(routeData);
const STEP = BALANCE.time.stepMs;
const homeIndex = route.stops.findIndex((s) => s.isHome);
const B = BALANCE.score;

/** Plays a run: keeps eyes open every `eyesEveryMs` (0 = never) and requests a stop after leaving `afterStop`. */
function play(afterStop: number | null, opts: { seed?: number; eyesEveryMs?: number; fatigue?: number } = {}) {
  const session = GameSession.start({ seed: opts.seed ?? 1, fatigue: opts.fatigue ?? 0.5 }, route);
  const every = opts.eyesEveryMs ?? 400;
  let ms = 0;
  while (!session.finished && ms < 10 * 60_000) {
    session.step(STEP);
    ms += STEP;
    if (every > 0 && ms % every === 0) session.handleInput('openEyes');
    const r = session.state.ride;
    if (afterStop !== null && r.stopIndex === afterStop && r.phase !== 'dwelling') session.handleInput('requestStop');
  }
  return session;
}

const total = (r: { scoreItems: { points: number }[] }) => r.scoreItems.reduce((s, i) => s + i.points, 0);

describe('buildReport', () => {
  it('home', () => {
    const r = buildReport(play(homeIndex - 1).state, route);
    expect(r.outcome).toEqual({ kind: 'home' });
    expect(r.alightStopName).toBe('Leinolan koulu');
    expect(r.wrongStops).toBe(0);
    expect(r.microsleeps).toBe(0);
    expect(r.boardedStopName).toBe('Sorin aukio E');
    expect(r.boardedTime).toBe(BALANCE.start.time);
    expect(r.alightTime).toMatch(/^02:\d\d$/);
    expect(r.awakeMinutes).toBeCloseTo(r.rideMinutes);
    expect(r.score).toBe(B.base + Math.floor(r.awakeMinutes) * B.awakeBonusPerMin);
    expect(r.scoreItems.map((i) => i.kind)).toEqual(['base', 'awake']);
  });

  it('tooEarly', () => {
    const r = buildReport(play(homeIndex - 4).state, route);
    expect(r.outcome).toEqual({ kind: 'tooEarly', stops: 3 });
    expect(r.wrongStops).toBe(3);
    expect(r.scoreItems).toContainEqual({ kind: 'wrongStops', count: 3, points: -3 * B.wrongStopPenalty });
    expect(r.score).toBe(Math.max(0, total(r)));
  });

  it('overshot', () => {
    const r = buildReport(play(homeIndex + 1).state, route);
    expect(r.outcome).toEqual({ kind: 'overshot', stops: 2 });
    expect(r.scoreItems).toContainEqual({ kind: 'wrongStops', count: 2, points: -2 * B.wrongStopPenalty });
  });

  it('terminus, with microsleeps and stops missed', () => {
    const r = buildReport(play(null, { eyesEveryMs: 0, fatigue: 0.8, seed: 3 }).state, route);
    expect(r.outcome.kind).toBe('terminus');
    expect(r.alightStopName).toBe('Vatiala A');
    expect(r.microsleeps).toBeGreaterThan(0);
    expect(r.stopsMissed).toBeGreaterThan(0);
    expect(r.longestMicrosleepMin).toBeGreaterThanOrEqual(BALANCE.sleep.minMinutes);
    expect(r.sleptMinutes).toBeGreaterThanOrEqual(r.longestMicrosleepMin);
    expect(r.awakeMinutes).toBeCloseTo(r.rideMinutes - r.sleptMinutes);
    expect(r.scoreItems.map((i) => i.kind)).toEqual(['base', 'wrongStops', 'terminusFee', 'awake', 'microsleeps']);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.lines.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same run', () => {
    const a = buildReport(play(homeIndex - 1, { seed: 9 }).state, route);
    const b = buildReport(play(homeIndex - 1, { seed: 9 }).state, route);
    expect(a).toEqual(b);
  });

  it('is plain JSON data', () => {
    const r = buildReport(play(homeIndex - 1).state, route);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it('refuses an unfinished run', () => {
    expect(() => buildReport(GameSession.start({ seed: 1 }, route).state, route)).toThrow();
  });
});

describe('report lines', () => {
  const facts = buildReport(play(null, { eyesEveryMs: 0, fatigue: 0.8, seed: 3 }).state, route) as ReportFacts;

  it('picks at most three matching lines without duplicates', () => {
    const lines = pickLines(facts, REPORT_LINES);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('only uses lines whose condition matches', () => {
    const lines = pickLines({ ...facts, outcome: { kind: 'home' } }, [
      { when: (r) => r.outcome.kind === 'home', text: 'yes' },
      { when: () => false, text: 'no' },
    ]);
    expect(lines).toEqual(['yes']);
  });

  it('every line renders without errors for every outcome', () => {
    for (const outcome of [{ kind: 'home' }, { kind: 'tooEarly', stops: 2 }, { kind: 'overshot', stops: 1 }, facts.outcome] as const) {
      for (const line of REPORT_LINES) {
        const f = { ...facts, outcome };
        if (line.when(f)) expect(typeof line.text === 'function' ? line.text(f) : line.text).toMatch(/\S/);
      }
    }
  });
});

describe('receiptNumber', () => {
  it('is five digits from the seed', () => {
    expect(receiptNumber(42)).toBe('00042');
    expect(receiptNumber(1234567)).toBe('34567');
  });
});

describe('best score', () => {
  const memory = (): KeyValueStorage & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };
  const report = (score: number) => ({ ...buildReport(play(homeIndex - 1).state, route), score });
  const now = new Date('2026-10-31T02:30:00Z');

  it('saves only improvements and survives a "reload"', () => {
    const storage = memory();
    expect(loadBest(storage)).toBeNull();
    expect(saveIfBest(report(800), now, storage)).toBe(true);
    expect(saveIfBest(report(500), now, storage)).toBe(false);
    expect(saveIfBest(report(900), now, storage)).toBe(true);
    // A fresh read (as after a page reload) sees the stored record.
    expect(loadBest(storage)?.score).toBe(900);
    expect([...storage.data.keys()]).toEqual(['yobussi.v1.best']);
  });

  it('never counts a zero score as a record', () => {
    const storage = memory();
    expect(saveIfBest(report(0), now, storage)).toBe(false);
    expect(loadBest(storage)).toBeNull();
  });

  it('ignores corrupted data and throwing storage', () => {
    const storage = memory();
    storage.setItem('yobussi.v1.best', '{not json');
    expect(loadBest(storage)).toBeNull();
    const throwing: KeyValueStorage = {
      getItem: () => {
        throw new Error('private mode');
      },
      setItem: () => {
        throw new Error('private mode');
      },
    };
    expect(loadBest(throwing)).toBeNull();
    expect(() => saveIfBest(report(100), now, throwing)).not.toThrow();
  });
});
