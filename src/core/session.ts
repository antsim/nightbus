import { BALANCE } from '../data/balance';
import { stepRide, type RideEvent } from './busRide';
import {
  jolt,
  microsleepMinutes,
  openEyes,
  startSleep,
  updateEyes,
  updateSleep,
} from './drowsiness';
import { gameMinutesFor } from './clock';
import { EventBus, type GameEventName, type GameEvents } from './events';
import { garbleLevel } from './garble';
import { addModifier, setMeterValue, updateMeters, type MeterId, type Modifier } from './meters';
import { rngFrom, type Rng } from './rng';
import type { Route } from './route';
import { resolveOutcome, type Outcome } from './outcome';
import { createRun, type LogEntry, type RunInit, type RunState } from './runState';

/** Player actions. More (e.g. browsing the phone) will be added later. */
export type PlayerAction = 'openEyes' | 'requestStop';

/** Owns the state of one run and advances it in fixed steps. Passed between scenes. */
export class GameSession {
  readonly bus = new EventBus<GameEvents>();
  readonly rng: Rng;
  private accumulatorMs = 0;
  /** Ride offset before the latest step, for smooth rendering between steps. */
  private previousOffsetSec: number;
  private previousEyelid: number;

  /** Without a route the bus doesn't move (e.g. pure meter tests, future walking phase). */
  constructor(
    readonly state: RunState,
    readonly route?: Route,
  ) {
    this.rng = rngFrom(state);
    this.previousOffsetSec = state.ride.offsetSec;
    this.previousEyelid = state.drowsiness.eyelid;
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

  /** Advances the simulation by exactly one step of `realMs` real milliseconds. */
  step(realMs: number): void {
    const s = this.state;
    this.previousOffsetSec = s.ride.offsetSec;
    this.previousEyelid = s.drowsiness.eyelid;

    if (s.outcome) return;

    // During a microsleep's blackout the skipped time has already been applied.
    if (s.drowsiness.phase === 'asleep') {
      const sleep = updateSleep(s.drowsiness, realMs);
      s.drowsiness = sleep.state;
      if (sleep.wokeUp) this.bus.emit('wokeUp', { durationMin: s.drowsiness.longestMicrosleepMin });
      this.previousEyelid = s.drowsiness.eyelid;
      return;
    }

    const dtMin = gameMinutesFor(s.clock, realMs);
    this.advanceWorld(dtMin, false);

    const eyes = updateEyes(s.drowsiness, realMs / 1000, s.meters.fatigue.value, this.rng, s.seed);
    s.drowsiness = eyes.state;
    if (eyes.waveStarted && s.drowsiness.wave) this.bus.emit('waveStarted', { depth: s.drowsiness.wave.depth });
    if (eyes.fellAsleep) this.fallAsleep();
  }

  /** Moves clock, meters and bus forward by `dtMin` game minutes. */
  private advanceWorld(dtMin: number, asleep: boolean): RideEvent[] {
    const s = this.state;
    s.clock = { ...s.clock, minutes: s.clock.minutes + dtMin };

    const result = updateMeters(s.meters, s.modifiers, dtMin);
    s.meters = result.meters;
    s.modifiers = result.modifiers;
    for (const mod of result.expired) this.record('modifierExpired', { id: mod.id, meter: mod.meter });

    if (!this.route) return [];
    const before = s.ride;
    const ride = stepRide(before, this.route, dtMin * 60);
    s.ride = ride.ride;

    for (const { type, stopId, stopIndex } of ride.events) {
      if (s.outcome) break;
      const payload = { stopId, stopIndex };
      if (asleep) {
        if (type === 'stopReached') this.record('stopMissedWhileAsleep', payload);
        if (type === 'terminusReached') this.record('terminusReached', payload);
      } else if (type === 'stopReached' || type === 'terminusReached') {
        // Arrivals are significant for the report; approach/departure are only notifications.
        this.record(type, payload);
      } else {
        this.bus.emit(type, payload);
        if (type === 'stopApproaching') this.announce(stopIndex);
      }

      if (type === 'stopReached') {
        // The bus stops here; a pending request lets the player off if they are awake.
        const getsOff = s.stopRequested && !asleep;
        s.stopRequested = false;
        if (getsOff) this.alight(stopIndex);
      }
      if (type === 'terminusReached' && !s.outcome) this.alight(stopIndex);
    }

    if (!asleep) {
      if (s.ride.phase === 'braking' && before.phase !== 'braking') this.applyBrakeJolt();
      const spacing = BALANCE.streetLights.spacingRouteSec;
      if (Math.floor(s.ride.offsetSec / spacing) > Math.floor(before.offsetSec / spacing)) {
        this.bus.emit('streetLightPassed', {});
        this.applyJolt('streetLight', BALANCE.wakers.streetLightJolt);
      }
    }
    return ride.events;
  }

  private applyJolt(source: 'brake' | 'streetLight', amount: number): void {
    if (this.state.drowsiness.phase !== 'awake') return;
    this.state.drowsiness = jolt(this.state.drowsiness, amount);
    this.bus.emit('jolt', { source, amount });
  }

  private applyBrakeJolt(): void {
    const w = BALANCE.wakers;
    this.applyJolt('brake', w.brakeJolt);
    this.state.modifiers = addModifier(this.state.modifiers, { id: 'brake-jolt', meter: 'fatigue', ...w.brakeModifier });
  }

  /** Eyes stayed shut: skip game time, letting the bus drive on without the player. */
  private fallAsleep(): void {
    const s = this.state;
    const fatigue = s.meters.fatigue.value;
    const startMin = s.clock.minutes;
    const durationMin = microsleepMinutes(fatigue, this.rng);

    const events = this.advanceWorld(durationMin, true);
    s.meters = {
      ...s.meters,
      fatigue: setMeterValue(s.meters.fatigue, s.meters.fatigue.value - BALANCE.sleep.fatigueRecovery),
    };
    s.drowsiness = startSleep(s.drowsiness, startMin, durationMin, this.rng, fatigue);
    this.previousOffsetSec = s.ride.offsetSec;
    this.previousEyelid = 1;

    const stopsMissed = events.filter((e) => e.type === 'stopReached').map((e) => e.stopId);
    this.record('microsleep', { startMin, durationMin, stopsMissed });
  }

  private announce(stopIndex: number): void {
    const stop = this.route?.stops[stopIndex];
    if (!stop) return;
    const m = this.state.meters;
    const announcement = {
      stopId: stop.id,
      stopName: stop.name,
      level: garbleLevel(m.intoxication.value, m.fatigue.value),
      seed: this.rng.int(0, 0x7fffffff),
    };
    this.state.announcement = announcement;
    this.bus.emit('announcement', announcement);
  }

  /** Player leaves the bus at this stop; the run ends with an outcome. */
  private alight(stopIndex: number): void {
    const stop = this.route?.stops[stopIndex];
    if (!stop || !this.route) return;
    const s = this.state;
    const outcome = resolveOutcome(this.route, stop.id);
    const alight = {
      stopId: stop.id,
      stopName: stop.name,
      stopIndex,
      lat: stop.lat,
      lon: stop.lon,
      timeMin: s.clock.minutes,
    };
    s.alight = alight;
    s.outcome = outcome;
    this.record('alighted', { alight, outcome });
    this.bus.emit('runEnded', { outcome });
  }

  /** Debug/testing: set a meter directly (F3). */
  setMeter(id: MeterId, value: number): void {
    this.state.meters = { ...this.state.meters, [id]: setMeterValue(this.state.meters[id], value) };
  }

  /** Applies a player action immediately (between steps). */
  handleInput(action: PlayerAction): void {
    const d = this.state.drowsiness;
    switch (action) {
      case 'openEyes': {
        const next = openEyes(d, d.elapsedMs + this.accumulatorMs);
        this.state.drowsiness = next;
        this.previousEyelid = Math.min(this.previousEyelid, next.eyelid);
        if (next.startles > d.startles) this.record('startled', { eyelid: next.eyelid });
        break;
      }
      case 'requestStop':
        this.requestStop();
        break;
    }
  }

  /** Stop button: the bus stops at the next stop. Does nothing while asleep or once requested. */
  private requestStop(): void {
    const s = this.state;
    if (s.outcome || s.stopRequested || s.drowsiness.phase !== 'awake' || s.ride.phase === 'finished') return;
    s.stopRequested = true;
    this.record('stopRequested', { atOffsetSec: s.ride.offsetSec });
  }

  /** Eyelid interpolated between the last two steps, for rendering. */
  renderEyelid(): number {
    const alpha = this.accumulatorMs / BALANCE.time.stepMs;
    return this.previousEyelid + (this.state.drowsiness.eyelid - this.previousEyelid) * alpha;
  }

  /** Ride offset interpolated between the last two steps, for rendering. */
  renderOffsetSec(): number {
    const alpha = this.accumulatorMs / BALANCE.time.stepMs;
    return this.previousOffsetSec + (this.state.ride.offsetSec - this.previousOffsetSec) * alpha;
  }

  /** The run is over: the player got off or the bus reached the terminus. */
  get finished(): boolean {
    return this.state.outcome !== null || this.state.ride.phase === 'finished';
  }

  get outcome(): Outcome | null {
    return this.state.outcome;
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
