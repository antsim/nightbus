import { BALANCE } from '../data/balance';
import { advanceClock, gameMinutesFor } from './clock';
import { EventBus, type GameEventName, type GameEvents } from './events';
import { addModifier, updateMeters, type Modifier } from './meters';
import { rngFrom, type Rng } from './rng';
import { createRun, type LogEntry, type RunInit, type RunState } from './runState';

/** Owns the state of one run and advances it in fixed steps. Passed between scenes. */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  readonly rng: Rng;
  private accumulatorMs = 0;

  constructor(readonly state: RunState) {
    this.rng = rngFrom(state);
  }

  static start(init: RunInit): GameSession {
    const session = new GameSession(createRun(init));
    session.record('runStarted', { seed: init.seed, routeId: session.state.route.routeId });
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

  static fromJSON(json: string): GameSession {
    return new GameSession(JSON.parse(json) as RunState);
  }
}
