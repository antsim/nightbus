import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import routes from '../data/routes/bus-nro6.json';
import { createRide, stepRide, type BusRideState, type RideEvent } from './busRide';
import { parseRoute, type Route } from './route';
import { GameSession } from './session';
import { attentiveBot, driveBot } from './testing/bots';

const stop = (id: string, offsetSec: number, extra: object = {}) => ({ id, name: id, lat: 0, lon: 0, offsetSec, ...extra });

const route: Route = parseRoute({
  id: 'test',
  lineName: 'T',
  headsign: 'D',
  stops: [stop('a', 0), stop('b', 60), stop('c', 75, { isHome: true }), stop('d', 200, { isTerminus: true })],
  landmarks: [],
});

/** Runs the ride to the end in fixed steps, collecting every event and state. */
function runToEnd(dtSec: number, r: Route = route) {
  let ride = createRide(r.id);
  const events: RideEvent[] = [];
  const states: BusRideState[] = [ride];
  let t = 0;
  while (ride.phase !== 'finished') {
    const step = stepRide(ride, r, dtSec);
    ride = step.ride;
    events.push(...step.events);
    states.push(ride);
    t += dtSec;
    if (t > 100_000) throw new Error('ride never finished');
  }
  return { ride, events, states, totalSec: t };
}

describe('busRide', () => {
  it('visits every stop in order: approach → reach → depart', () => {
    const { events } = runToEnd(0.25);
    expect(events.map((e) => `${e.type}:${e.stopId}`)).toEqual([
      'stopDeparted:a',
      'stopApproaching:b',
      'stopReached:b',
      'stopDeparted:b',
      'stopApproaching:c',
      'stopReached:c',
      'stopDeparted:c',
      'stopApproaching:d',
      'stopReached:d',
      'terminusReached:d',
    ]);
  });

  it('dwells at each stop for dwellSec without moving', () => {
    let ride = createRide(route.id);
    const dt = 0.1;
    let dwellTime = 0;
    let departed = false;
    while (!departed) {
      const step = stepRide(ride, route, dt);
      departed = step.events.some((e) => e.type === 'stopDeparted');
      if (!departed) {
        expect(step.ride.offsetSec).toBe(0);
        expect(step.ride.speed).toBe(0);
        dwellTime += dt;
      }
      ride = step.ride;
    }
    expect(dwellTime).toBeCloseTo(BALANCE.bus.dwellSec, 0);

    // Same dwell at an intermediate stop.
    const { states } = runToEnd(0.1);
    const atB = states.filter((s) => s.phase === 'dwelling' && s.stopIndex === 1);
    expect(atB.length * 0.1).toBeCloseTo(BALANCE.bus.dwellSec, 0);
    expect(new Set(atB.map((s) => s.offsetSec))).toEqual(new Set([60]));
  });

  it('accelerates after departing and brakes before a stop', () => {
    const { states } = runToEnd(0.1);
    const leg = states.filter((s) => s.stopIndex === 0 && s.phase !== 'dwelling');
    const phases = [...new Set(leg.map((s) => s.phase))];
    expect(phases).toEqual(['accelerating', 'driving', 'braking']);

    const speeds = leg.map((s) => s.speed);
    const peak = Math.max(...speeds);
    expect(peak).toBeCloseTo(BALANCE.bus.cruiseSpeed);
    expect(speeds[0]).toBeLessThan(peak);
    expect(speeds[speeds.length - 1]).toBeLessThan(peak * 0.5);
    for (const s of states) expect(s.speed).toBeLessThanOrEqual(BALANCE.bus.cruiseSpeed + 1e-9);
  });

  it('never moves backwards or past the terminus', () => {
    const { states } = runToEnd(0.5);
    for (let i = 1; i < states.length; i++) {
      expect(states[i]!.offsetSec).toBeGreaterThanOrEqual(states[i - 1]!.offsetSec);
    }
    expect(states.at(-1)!.offsetSec).toBe(200);
  });

  it('finishes at the terminus and then stays put', () => {
    const { ride, events } = runToEnd(1);
    expect(ride.phase).toBe('finished');
    expect(ride.stopIndex).toBe(3);
    expect(events.filter((e) => e.type === 'terminusReached')).toHaveLength(1);

    const after = stepRide(ride, route, 1000);
    expect(after.events).toEqual([]);
    expect(after.ride).toEqual(ride);
  });

  it('gives the same result for one long step as for many short ones', () => {
    const fine = runToEnd(0.05);
    const oneShot = stepRide(createRide(route.id), route, fine.totalSec + 1);
    expect(oneShot.events.map((e) => e.type)).toEqual(fine.events.map((e) => e.type));
    expect(oneShot.ride.phase).toBe('finished');
  });

  it('does not mutate the input state', () => {
    const ride = createRide(route.id);
    const copy = { ...ride };
    stepRide(ride, route, 50);
    expect(ride).toEqual(copy);
  });
});

describe('GameSession with a route', () => {
  const line6 = parseRoute(routes);

  it('drives the default route in 3–4 minutes of real time when awake', () => {
    const session = driveBot(GameSession.start({ seed: 1 }, line6), attentiveBot());
    const realMs = session.state.drowsiness.elapsedMs;
    expect(session.state.drowsiness.microsleeps).toBe(0);
    expect(session.finished).toBe(true);
    expect(realMs / 60_000).toBeGreaterThan(3);
    expect(realMs / 60_000).toBeLessThan(4);
  });

  it('logs arrivals and only announces approaches and departures', () => {
    const session = GameSession.start({ seed: 1, timeScale: 6 }, line6);
    // Not about nausea: eyes stay open at this speed, so keep the player from getting sick.
    session.addModifier({ id: 'test-no-nausea', meter: 'nausea', ratePerMin: -1 });
    const approaching: string[] = [];
    session.bus.on('stopApproaching', ({ stopId }) => approaching.push(stopId));
    while (!session.finished) session.step(BALANCE.time.stepMs);

    const reached = session.state.log.filter((e) => e.type === 'stopReached');
    expect(reached).toHaveLength(line6.stops.length - 1);
    expect(session.state.log.filter((e) => e.type === 'terminusReached')).toHaveLength(1);
    expect(session.state.log.some((e) => e.type === 'stopApproaching' || e.type === 'stopDeparted')).toBe(false);
    expect(approaching).toEqual(line6.stops.slice(1).map((s) => s.id));
  });

  it('F2-style time scale speeds up the ride', () => {
    const normal = GameSession.start({ seed: 1 }, line6);
    const fast = GameSession.start({ seed: 1 }, line6);
    fast.setTimeScale(BALANCE.time.timeScale * BALANCE.time.debugSpeedMultiplier);
    for (let i = 0; i < 300; i++) {
      normal.tick(100);
      fast.tick(100);
    }
    expect(fast.state.ride.offsetSec).toBeGreaterThan(normal.state.ride.offsetSec * 2);
  });

  it('interpolates the render offset between steps', () => {
    const session = GameSession.start({ seed: 1, timeScale: 6 }, line6);
    session.simulateMinutes(1);
    const before = session.state.ride.offsetSec;
    session.tick(BALANCE.time.stepMs);
    const after = session.state.ride.offsetSec;
    session.tick(BALANCE.time.stepMs / 2);
    const mid = session.renderOffsetSec();
    expect(mid).toBeGreaterThanOrEqual(before);
    expect(mid).toBeLessThanOrEqual(after);
  });
});
