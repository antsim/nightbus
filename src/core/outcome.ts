import type { Route } from './route';

export type Outcome =
  | { kind: 'home' }
  | { kind: 'tooEarly'; stops: number }
  | { kind: 'overshot'; stops: number }
  | { kind: 'terminus'; stops: number };

export type OutcomeKind = Outcome['kind'];

/** Where the player got off, saved for the survival phase later. */
export interface AlightInfo {
  stopId: string;
  stopName: string;
  stopIndex: number;
  lat: number;
  lon: number;
  /** Game clock minutes. */
  timeMin: number;
}

/** Result of leaving the bus at `alightStopId`. Reaching the terminus always ends as 'terminus'. */
export function resolveOutcome(route: Route, alightStopId: string): Outcome {
  const index = route.stops.findIndex((s) => s.id === alightStopId);
  if (index < 0) throw new Error(`Stop "${alightStopId}" is not on route "${route.id}"`);
  const home = route.stops.findIndex((s) => s.isHome);
  const diff = index - home;
  if (diff === 0) return { kind: 'home' };
  if (diff < 0) return { kind: 'tooEarly', stops: -diff };
  if (index === route.stops.length - 1) return { kind: 'terminus', stops: diff };
  return { kind: 'overshot', stops: diff };
}
