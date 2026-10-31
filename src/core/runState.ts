import { BALANCE } from '../data/balance';
import { createClock, type ClockState } from './clock';
import type { GameEventName, GameEvents } from './events';
import { createMeters, type ActiveModifier, type Meters } from './meters';
import { seedToState } from './rng';

/** One significant event, stored for the end-of-run report. */
export type LogEntry = {
  [K in GameEventName]: { time: number; type: K; data: GameEvents[K] };
}[GameEventName];

export interface RoutePosition {
  routeId: string;
  /** Seconds from the start of the route. */
  offsetSec: number;
}

/** Complete state of one run. Plain JSON data only, so it can be saved and restored. */
export interface RunState {
  version: 1;
  seed: number;
  rngState: number;
  clock: ClockState;
  meters: Meters;
  /** Euro cents. */
  money: number;
  modifiers: ActiveModifier[];
  route: RoutePosition;
  log: LogEntry[];
}

export interface RunInit {
  seed: number;
  intoxication?: number;
  fatigue?: number;
  cold?: number;
  money?: number;
  startTime?: string;
  routeId?: string;
  timeScale?: number;
}

export function createRun(init: RunInit): RunState {
  const start = BALANCE.start;
  return {
    version: 1,
    seed: init.seed,
    rngState: seedToState(init.seed),
    clock: createClock(init.startTime ?? start.time, init.timeScale ?? BALANCE.time.timeScale),
    meters: createMeters({
      intoxication: init.intoxication ?? start.intoxication,
      fatigue: init.fatigue ?? start.fatigue,
      cold: init.cold ?? start.cold,
    }),
    money: Math.round(init.money ?? start.money),
    modifiers: [],
    route: { routeId: init.routeId ?? start.routeId, offsetSec: 0 },
    log: [],
  };
}
