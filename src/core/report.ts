import { BALANCE } from '../data/balance';
import { REPORT_LINES } from '../data/reportLines.fi';
import { formatTime } from './clock';
import type { Outcome } from './outcome';
import { createRng } from './rng';
import type { Route } from './route';
import type { RunState } from './runState';

/** Score line on the receipt. Labels are resolved from strings by `kind`. */
export type ScoreItem =
  | { kind: 'base'; points: number }
  | { kind: 'wrongStops'; count: number; points: number }
  | { kind: 'terminusFee'; points: number }
  | { kind: 'awake'; minutes: number; points: number }
  | { kind: 'microsleeps'; count: number; points: number };

/** Facts about one run, without the humorous lines. Plain data: can be shared, saved or sent later. */
export interface ReportFacts {
  seed: number;
  /** "Receipt number" derived from the seed. */
  receiptNo: string;
  routeId: string;
  lineName: string;
  headsign: string;
  boardedStopName: string;
  boardedTime: string;
  outcome: Outcome;
  alightStopName: string;
  alightTime: string;
  rideMinutes: number;
  microsleeps: number;
  longestMicrosleepMin: number;
  sleptMinutes: number;
  /** Stops passed while asleep. */
  stopsMissed: number;
  /** Stops between the home stop and where the player got off (0 when home). */
  wrongStops: number;
  awakeMinutes: number;
  scoreItems: ScoreItem[];
  score: number;
}

export interface RunReport extends ReportFacts {
  lines: string[];
}

export interface ReportLine {
  when: (r: ReportFacts) => boolean;
  text: string | ((r: ReportFacts) => string);
}

export function receiptNumber(seed: number): string {
  return String(seed % 100000).padStart(5, '0');
}

export function scoreItems(outcome: Outcome, awakeMinutes: number, microsleeps: number): ScoreItem[] {
  const b = BALANCE.score;
  const items: ScoreItem[] = [{ kind: 'base', points: b.base }];
  if (outcome.kind !== 'home') {
    items.push({ kind: 'wrongStops', count: outcome.stops, points: -b.wrongStopPenalty * outcome.stops });
  }
  if (outcome.kind === 'terminus') items.push({ kind: 'terminusFee', points: -b.terminusPenalty });
  const minutes = Math.floor(awakeMinutes);
  items.push({ kind: 'awake', minutes, points: minutes * b.awakeBonusPerMin });
  if (microsleeps > 0) items.push({ kind: 'microsleeps', count: microsleeps, points: -b.microsleepPenalty * microsleeps });
  return items;
}

/** Picks up to `max` matching lines with an RNG derived from the seed (same run → same lines). */
export function pickLines(facts: ReportFacts, lines: readonly ReportLine[], max = BALANCE.score.maxLines): string[] {
  const rng = createRng(facts.seed ^ 0x9e3779b9);
  const pool = lines.filter((l) => l.when(facts));
  const picked: string[] = [];
  while (pool.length > 0 && picked.length < max) {
    const [line] = pool.splice(rng.int(0, pool.length - 1), 1);
    if (line) picked.push(typeof line.text === 'function' ? line.text(facts) : line.text);
  }
  return picked;
}

/** Builds the end-of-run report from the run state and its event log. */
export function buildReport(state: RunState, route: Route, lines: readonly ReportLine[] = REPORT_LINES): RunReport {
  if (!state.outcome || !state.alight) throw new Error('Run has not ended yet');
  const first = state.log.find((e) => e.type === 'runStarted');
  const startMin = first?.time ?? state.clock.minutes;
  const sleeps = state.log.flatMap((e) => (e.type === 'microsleep' ? [e.data] : []));
  const sleptMinutes = sleeps.reduce((sum, s) => sum + s.durationMin, 0);
  const rideMinutes = state.alight.timeMin - startMin;
  const awakeMinutes = Math.max(0, rideMinutes - sleptMinutes);
  const homeIndex = route.stops.findIndex((s) => s.isHome);
  const items = scoreItems(state.outcome, awakeMinutes, sleeps.length);

  const facts: ReportFacts = {
    seed: state.seed,
    receiptNo: receiptNumber(state.seed),
    routeId: route.id,
    lineName: route.lineName,
    headsign: route.headsign,
    boardedStopName: route.stops[0]?.name ?? '',
    boardedTime: formatTime(startMin),
    outcome: state.outcome,
    alightStopName: state.alight.stopName,
    alightTime: formatTime(state.alight.timeMin),
    rideMinutes,
    microsleeps: sleeps.length,
    longestMicrosleepMin: sleeps.reduce((max, s) => Math.max(max, s.durationMin), 0),
    sleptMinutes,
    stopsMissed: state.log.filter((e) => e.type === 'stopMissedWhileAsleep').length,
    wrongStops: Math.abs(state.alight.stopIndex - homeIndex),
    awakeMinutes,
    scoreItems: items,
    score: Math.max(0, items.reduce((sum, i) => sum + i.points, 0)),
  };
  return { ...facts, lines: pickLines(facts, lines) };
}
