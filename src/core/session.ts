import { BALANCE } from '../data/balance';
import { stepRide, tooLateForNext, type RideEvent } from './busRide';
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
import { addModifier, setMeterValue, updateMeters, type MeterContext, type MeterId, type Modifier } from './meters';
import { rngFrom, type Rng } from './rng';
import type { Route } from './route';
import { resolveOutcome, type Outcome } from './outcome';
import { stopPlan, type StopPlan } from './passengers';
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
    // Meters (nausea) use the eyelid from the previous step; eyes update after
    // the world. One 100 ms step of lag is not noticeable.
    this.advanceWorld(dtMin, false);
    if (s.outcome) return;

    const eyes = updateEyes(s.drowsiness, realMs / 1000, s.meters.fatigue.value, this.rng, s.seed);
    s.drowsiness = eyes.state;
    if (eyes.waveStarted && s.drowsiness.wave) this.bus.emit('waveStarted', { depth: s.drowsiness.wave.depth });
    if (eyes.fellAsleep) this.fallAsleep();
  }

  /** Moves clock, meters and bus forward by `dtMin` game minutes. */
  private advanceWorld(dtMin: number, asleep: boolean): RideEvent[] {
    const s = this.state;
    s.clock = { ...s.clock, minutes: s.clock.minutes + dtMin };

    const result = updateMeters(s.meters, s.modifiers, dtMin, this.meterContext(asleep));
    s.meters = result.meters;
    s.modifiers = result.modifiers;
    for (const mod of result.expired) this.record('modifierExpired', { id: mod.id, meter: mod.meter });
    if (!s.sick && s.meters.nausea.value >= 1) this.becomeSick();

    if (!this.route) return [];
    const before = s.ride;
    // The player's request counts for the first stop decided in this step only;
    // a long (microsleep) step may pass several stops before events are handled.
    let playerRequestUsed = false;
    const wantsStop = (index: number) => {
      const player = s.playerRequested && !playerRequestUsed;
      if (player) playerRequestUsed = true;
      const plan = this.stopPlan(index);
      return player || plan.waiting || plan.otherRequest;
    };
    const ride = stepRide(before, this.route, dtMin * 60, wantsStop);
    s.ride = ride.ride;

    for (const { type, stopId, stopIndex } of ride.events) {
      if (s.outcome) break;
      const payload = { stopId, stopIndex };
      // When sick, the other passengers get the player off even asleep: not a missed stop.
      const forcedOff = type === 'stopReached' && s.sick && s.playerRequested;
      if (asleep && !forcedOff) {
        if (type === 'stopReached' || type === 'stopPassed') this.record('stopMissedWhileAsleep', payload);
        if (type === 'terminusReached') this.record('terminusReached', payload);
      } else if (type === 'stopReached' || type === 'stopPassed' || type === 'terminusReached') {
        // Arrivals and pass-bys are significant for the report; approach/departure are only notifications.
        this.record(type, payload);
      } else {
        this.bus.emit(type, payload);
        if (type === 'stopApproaching') this.announce(stopIndex);
      }

      if (type === 'stopReached') {
        // The bus stops here; only the player's own request lets them off, and only
        // awake (when sick, the other passengers make sure they get off anyway).
        const getsOff = s.playerRequested && (!asleep || s.sick);
        s.playerRequested = false;
        s.otherRequested = false;
        if (getsOff) this.alight(stopIndex);
      }
      if (type === 'terminusReached' && !s.outcome) this.alight(stopIndex);
    }
    if (!s.outcome) this.checkOtherRequest();

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

  /** Who waits at stop `index` and whether another passenger asks to stop there. */
  stopPlan(index: number): StopPlan {
    return this.route ? stopPlan(this.state.seed, this.route, index) : { waiting: false, otherRequest: false, otherAtOffsetSec: null };
  }

  /** Another passenger presses the button once the bus passes their moment. */
  private checkOtherRequest(): void {
    const s = this.state;
    if (s.otherRequested || s.ride.phase === 'finished') return;
    const index = s.ride.stopIndex + 1;
    const plan = this.stopPlan(index);
    if (plan.otherAtOffsetSec === null || s.ride.offsetSec < plan.otherAtOffsetSec) return;
    s.otherRequested = true;
    const stop = this.route?.stops[index];
    if (stop) this.bus.emit('otherStopRequested', { stopId: stop.id, stopIndex: index });
  }

  /** Rates depend on how open the eyes are and whether the bus is moving. */
  meterContext(asleep = this.state.drowsiness.phase === 'asleep'): MeterContext {
    const s = this.state;
    return { eyelid: asleep ? 1 : s.drowsiness.eyelid, busPhase: this.route ? s.ride.phase : null };
  }

  /** Nausea hit the limit: a stop request that cannot be cancelled. */
  private becomeSick(): void {
    const s = this.state;
    s.sick = true;
    s.playerRequested = true;
    this.record('nauseaCritical', { atOffsetSec: s.ride.offsetSec });
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

    const stopsMissed = events.filter((e) => e.type === 'stopReached' || e.type === 'stopPassed').map((e) => e.stopId);
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
    const outcome = resolveOutcome(this.route, stop.id, s.sick);
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

  /**
   * Stop button: the bus stops at the next stop. Too close to it and the driver
   * can't stop any more; the request then holds for the stop after. Does nothing
   * while asleep or once requested.
   */
  private requestStop(): void {
    const s = this.state;
    if (s.outcome || s.playerRequested || s.drowsiness.phase !== 'awake' || s.ride.phase === 'finished') return;
    s.playerRequested = true;
    this.record('stopRequested', { atOffsetSec: s.ride.offsetSec });
    const missed = this.route?.stops[s.ride.stopIndex + 1];
    if (tooLateForNext(s.ride) && missed) this.record('requestTooLate', { stopId: missed.id, stopIndex: s.ride.stopIndex + 1 });
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
