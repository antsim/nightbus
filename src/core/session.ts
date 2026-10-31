import { BALANCE } from '../data/balance';
import { stepRide } from './busRide';
import { advanceClock, gameMinutesFor } from './clock';
import { EventBus, type GameEventName, type GameEvents } from './events';
import { addModifier, updateMeters, type Modifier } from './meters';
import { rngFrom, type Rng } from './rng';
import type { Route } from './route';
import { createRun, type LogEntry, type RunInit, type RunState } from './runState';

/** Owns the state of one run and advances it in fixed steps. Passed between scenes. */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  readonly rng: Rng;
  private accumulatorMs = 0;
  /** Ride offset before the latest step, for smooth rendering between steps. */
  private previousOffsetSec: number;

  /** Without a route the bus doesn't move (e.g. pure meter tests, future walking phase). */
  constructor(
    readonly state: RunState,
    readonly route?: Route,
  ) {
    this.rng = rngFrom(state);
    this.previousOffsetSec = state.ride.offsetSec;
  }

  static start(init: RunInit, route?: Route): GameSession {
    const run = createRun(route ? { ...init, routeId: route.id } : init);
    if (route?.stops[0]) run.ride.offsetSec = route.stops[0].offsetSec;
    const session = new GameSession(run, route);
    session.record('runStarted', { seed: init.seed, routeId: run.ride.routeId });
    return session;
  }

  /** Feed real frame time; runs as many fixed steps as fit. */
  tick(realMs: number): void {
    this.accumulatorMs += Math.min(Math.max(realMs, 0), BALANCE.time.maxFrameMs);
    while (this.accumulatorMs >= BALANCE.time.stepMs) {
      this.accumulatorMs -= BALANCE.time.stepMs;
      this.step(BALANCE.time.stepMs);
    }
  }

  /** Advances the simulation by exactly one step. */
  step(realMs: number): void {
    const s = this.state;
    const dtMin = gameMinutesFor(s.clock, realMs);
    s.clock = advanceClock(s.clock, realMs);

    const result = updateMeters(s.meters, s.modifiers, dtMin);
    s.meters = result.meters;
    s.modifiers = result.modifiers;
    for (const mod of result.expired) this.record('modifierExpired', { id: mod.id, meter: mod.meter });

    this.previousOffsetSec = s.ride.offsetSec;
    if (this.route) {
      const ride = stepRide(s.ride, this.route, dtMin * 60);
      s.ride = ride.ride;
      for (const { type, stopId, stopIndex } of ride.events) {
        const payload = { stopId, stopIndex };
        // Arrivals are significant for the report; approach/departure are only notifications.
        if (type === 'stopReached' || type === 'terminusReached') this.record(type, payload);
        else this.bus.emit(type, payload);
      }
    }
  }

  /** Ride offset interpolated between the last two steps, for rendering. */
  renderOffsetSec(): number {
    const alpha = this.accumulatorMs / BALANCE.time.stepMs;
    return this.previousOffsetSec + (this.state.ride.offsetSec - this.previousOffsetSec) * alpha;
  }

  get finished(): boolean {
    return this.state.ride.phase === 'finished';
  }

  /** Simulates `minutes` of game time (tests, microsleep skips). */
  simulateMinutes(minutes: number): void {
    const stepMin = gameMinutesFor(this.state.clock, BALANCE.time.stepMs);
    const steps = Math.round(minutes / stepMin);
    for (let i = 0; i < steps; i++) this.step(BALANCE.time.stepMs);
  }

  addModifier(modifier: Modifier): void {
    this.state.modifiers = addModifier(this.state.modifiers, modifier);
    const active = this.state.modifiers[this.state.modifiers.length - 1];
    if (active) this.record('modifierAdded', { modifier: { ...active } });
  }

  setTimeScale(timeScale: number): void {
    this.state.clock = { ...this.state.clock, timeScale };
    this.bus.emit('timeScaleChanged', { timeScale });
  }

  /** Logs a significant event to RunState and announces it on the bus. */
  record<K extends GameEventName>(type: K, data: GameEvents[K]): void {
    this.state.log.push({ time: this.state.clock.minutes, type, data } as LogEntry);
    this.bus.emit(type, data);
  }

  toJSON(): RunState {
    return this.state;
  }

  static fromJSON(json: string, route?: Route): GameSession {
    return new GameSession(JSON.parse(json) as RunState, route);
  }
}
