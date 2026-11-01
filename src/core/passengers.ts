import { BALANCE } from '../data/balance';
import { createRng } from './rng';
import type { Route } from './route';

// Other passengers. What happens at each stop is drawn from the run seed and
// the stop index alone, so it is the same no matter when it is asked (even in
// the middle of a microsleep skip) and the scenery can show it in advance.

export interface StopPlan {
  /** Someone waits at the stop: the bus stops to pick them up. */
  waiting: boolean;
  /** Another passenger asks to stop here... */
  otherRequest: boolean;
  /** ...when the bus passes this route offset (null if nobody asks). */
  otherAtOffsetSec: number | null;
}

const NOBODY: StopPlan = { waiting: false, otherRequest: false, otherAtOffsetSec: null };

export function stopPlan(seed: number, route: Route, index: number): StopPlan {
  const stop = route.stops[index];
  const prev = route.stops[index - 1];
  // Nobody gets on at the terminus, and the first stop is where the player boards.
  if (!stop || !prev || index === route.stops.length - 1) return NOBODY;

  const st = BALANCE.stops;
  const rng = createRng((Math.imul(seed, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0);
  const waiting = rng.next() < st.waitingChance;
  const otherRequest = rng.next() < (stop.busy ? st.busyOtherRequestChance : st.otherRequestChance);
  // Somewhere between the stops, but always early enough that the player can
  // notice the light and still press in time.
  const latest = Math.max(prev.offsetSec, stop.offsetSec - st.requestCutoffSec - st.minLeadSec);
  const at = rng.range(prev.offsetSec, latest);
  return { waiting, otherRequest, otherAtOffsetSec: otherRequest ? at : null };
}
