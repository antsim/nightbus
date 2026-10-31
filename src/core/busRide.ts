import { BALANCE } from '../data/balance';
import { clamp } from './math';
import type { Route } from './route';

// Bus movement along a route. Position is `offsetSec` on the route's own
// timeline (seconds from the first stop at timetable pace); speed is route
// seconds per game second, so speed 1 = timetable pace.

export type BusPhase = 'driving' | 'braking' | 'dwelling' | 'accelerating' | 'finished';

export interface BusRideState {
  routeId: string;
  offsetSec: number;
  phase: BusPhase;
  /** Game seconds spent in the current phase. */
  timeInPhaseSec: number;
  /** Game seconds since leaving the previous stop (drives the acceleration curve). */
  sinceDepartureSec: number;
  speed: number;
  /** Index of the stop the bus is at or last left. */
  stopIndex: number;
  /** Highest stop index already announced with stopApproaching. */
  approachedIndex: number;
}

export type RideEventType = 'stopApproaching' | 'stopReached' | 'stopDeparted' | 'terminusReached';

export interface RideEvent {
  type: RideEventType;
  stopId: string;
  stopIndex: number;
}

export interface RideStep {
  ride: BusRideState;
  events: RideEvent[];
}

/** Largest integration step; keeps braking accurate even for long skips. */
const MAX_SUBSTEP_SEC = 1;

/** The bus starts standing at the first stop with doors open. */
export function createRide(routeId: string, startOffsetSec = 0): BusRideState {
  return {
    routeId,
    offsetSec: startOffsetSec,
    phase: 'dwelling',
    timeInPhaseSec: 0,
    sinceDepartureSec: 0,
    speed: 0,
    stopIndex: 0,
    approachedIndex: 0,
  };
}

/** Speed and phase while moving, as a pure function of time since departure and distance left. */
export function movingSpeed(sinceDepartureSec: number, remainingSec: number): { speed: number; phase: BusPhase } {
  const b = BALANCE.bus;
  const accel = clamp(sinceDepartureSec / b.accelSec, 0, 1);
  // Constant deceleration: v ∝ √distance.
  const brake = Math.sqrt(clamp(remainingSec / b.brakeDistanceSec, 0, 1));
  const factor = Math.max(b.minSpeedFactor, Math.min(accel, brake));
  const phase: BusPhase = brake < 1 && brake <= accel ? 'braking' : accel < 1 ? 'accelerating' : 'driving';
  return { speed: b.cruiseSpeed * factor, phase };
}

/** Advances the ride by `dtSec` game seconds. Handles any number of stops within one call. */
export function stepRide(prev: BusRideState, route: Route, dtSec: number): RideStep {
  const ride = { ...prev };
  const events: RideEvent[] = [];
  const stops = route.stops;
  const emit = (type: RideEventType, index: number) => {
    const stop = stops[index];
    if (stop) events.push({ type, stopId: stop.id, stopIndex: index });
  };
  const setPhase = (phase: BusPhase) => {
    if (ride.phase !== phase) {
      ride.phase = phase;
      ride.timeInPhaseSec = 0;
    }
  };

  let dt = dtSec;
  while (dt > 1e-9 && ride.phase !== 'finished') {
    if (ride.phase === 'dwelling') {
      const left = BALANCE.bus.dwellSec - ride.timeInPhaseSec;
      if (dt < left) {
        ride.timeInPhaseSec += dt;
        dt = 0;
      } else {
        dt -= left;
        emit('stopDeparted', ride.stopIndex);
        setPhase('accelerating');
        ride.sinceDepartureSec = 0;
      }
      continue;
    }

    const next = stops[ride.stopIndex + 1];
    if (!next) {
      setPhase('finished');
      break;
    }
    const nextIndex = ride.stopIndex + 1;
    const remaining = next.offsetSec - ride.offsetSec;
    const h = Math.min(dt, MAX_SUBSTEP_SEC);
    const { speed, phase } = movingSpeed(ride.sinceDepartureSec, remaining);
    const move = speed * h;

    if (ride.approachedIndex < nextIndex && remaining - move <= BALANCE.bus.approachLeadSec) {
      ride.approachedIndex = nextIndex;
      emit('stopApproaching', nextIndex);
    }

    if (move >= remaining) {
      dt -= remaining / speed;
      ride.offsetSec = next.offsetSec;
      ride.stopIndex = nextIndex;
      ride.speed = 0;
      emit('stopReached', nextIndex);
      if (next.isTerminus || nextIndex === stops.length - 1) {
        emit('terminusReached', nextIndex);
        setPhase('finished');
      } else {
        setPhase('dwelling');
      }
    } else {
      ride.offsetSec += move;
      ride.sinceDepartureSec += h;
      ride.timeInPhaseSec += h;
      setPhase(phase);
      ride.speed = speed;
      dt -= h;
    }
  }

  return { ride, events };
}
