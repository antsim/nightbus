import { BALANCE } from '../data/balance';
import { createRide, type BusRideState } from './busRide';
import { createClock, type ClockState } from './clock';
import { createDrowsiness, type DrowsinessState } from './drowsiness';
import type { Announcement, GameEventName, GameEvents } from './events';
import { createMeters, type ActiveModifier, type Meters } from './meters';
import type { AlightInfo, Outcome } from './outcome';
import { rngFrom, seedToState } from './rng';

/** One significant event, stored for the end-of-run report. */
export type LogEntry = {
  [K in GameEventName]: { time: number; type: K; data: GameEvents[K] };
}[GameEventName];

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
  ride: BusRideState;
  drowsiness: DrowsinessState;
  /** Stop button pressed; cleared whenever the bus stops. */
  stopRequested: boolean;
  /** Nausea hit the limit: the player gets off at the next stop, even asleep. */
  sick: boolean;
  /** Latest stop announcement. */
  announcement: Announcement | null;
  outcome: Outcome | null;
  alight: AlightInfo | null;
  log: LogEntry[];
}

export interface RunInit {
  seed: number;
  intoxication?: number;
  fatigue?: number;
  cold?: number;
  nausea?: number;
  money?: number;
  startTime?: string;
  routeId?: string;
  timeScale?: number;
}

export function createRun(init: RunInit): RunState {
  const start = BALANCE.start;
  const rngHolder = { rngState: seedToState(init.seed) };
  const fatigue = init.fatigue ?? start.fatigue;
  const drowsiness = createDrowsiness(rngFrom(rngHolder), fatigue);
  return {
    version: 1,
    seed: init.seed,
    rngState: rngHolder.rngState,
    clock: createClock(init.startTime ?? start.time, init.timeScale ?? BALANCE.time.timeScale),
    meters: createMeters({
      intoxication: init.intoxication ?? start.intoxication,
      fatigue,
      cold: init.cold ?? start.cold,
      nausea: init.nausea ?? start.nausea,
    }),
    money: Math.round(init.money ?? start.money),
    modifiers: [],
    ride: createRide(init.routeId ?? start.routeId),
    drowsiness,
    stopRequested: false,
    sick: false,
    announcement: null,
    outcome: null,
    alight: null,
    log: [],
  };
}
