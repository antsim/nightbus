import { BALANCE } from '../data/balance';
import { clamp } from './math';
import { valueNoise1D } from './noise';
import type { Rng } from './rng';

// Eyes closing in waves. All times here are real time (player reaction
// time), not game time, so the eyelids feel the same regardless of the
// game clock speed.

export type EyePhase = 'awake' | 'asleep';

export interface EyelidWave {
  elapsedSec: number;
  durationSec: number;
  depth: number;
}

export interface DrowsinessState {
  /** 0 = eyes open, 1 = closed. */
  eyelid: number;
  phase: EyePhase;
  /** Real milliseconds simulated while awake (noise position and input timing). */
  elapsedMs: number;
  wave: EyelidWave | null;
  nextWaveInSec: number;
  waveCount: number;
  /** How long the eyes have been fully closed. */
  closedMs: number;
  /** Remaining blackout while asleep. */
  asleepMs: number;
  /** Remaining "where am I" period after waking. */
  confusedMs: number;
  lastInputMs: number | null;
  microsleeps: number;
  lastMicrosleepAtMin: number | null;
  longestMicrosleepMin: number;
}

const E = BALANCE.eyes;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export function nextWaveGapSec(fatigue: number, rng: Rng): number {
  return rng.range(E.wave.gapMinSec, E.wave.gapMaxSec) * lerp(E.wave.gapScaleRested, E.wave.gapScaleExhausted, fatigue);
}

export function createDrowsiness(rng: Rng, fatigue: number): DrowsinessState {
  return {
    eyelid: 0,
    phase: 'awake',
    elapsedMs: 0,
    wave: null,
    nextWaveInSec: nextWaveGapSec(fatigue, rng),
    waveCount: 0,
    closedMs: 0,
    asleepMs: 0,
    confusedMs: 0,
    lastInputMs: null,
    microsleeps: 0,
    lastMicrosleepAtMin: null,
    longestMicrosleepMin: 0,
  };
}

function startWave(fatigue: number, rng: Rng): EyelidWave {
  const w = E.wave;
  return {
    elapsedSec: 0,
    durationSec: rng.range(w.durationMinSec, w.durationMaxSec),
    depth: clamp(w.depthBase + w.depthPerFatigue * fatigue + rng.range(-w.depthJitter, w.depthJitter), 0, w.maxDepth),
  };
}

/** Wave pull: quick rise, slower fall. */
export function waveBump(wave: EyelidWave): number {
  const t = wave.elapsedSec / wave.durationSec;
  const rise = E.wave.riseShare;
  const shape = t < rise ? smoothstep(t / rise) : 1 - smoothstep((t - rise) / (1 - rise));
  return shape * wave.depth;
}

/** Where the eyelid is being pulled right now. */
export function eyelidTarget(state: DrowsinessState, fatigue: number, noiseSeed: number): number {
  const noise = valueNoise1D(noiseSeed, (state.elapsedMs / 1000) * E.noiseFrequency) * E.noiseAmplitude;
  const bump = state.wave ? waveBump(state.wave) : 0;
  const heaviness = smoothstep((state.eyelid - E.heavy.start) / (1 - E.heavy.start));
  const pull = lerp(E.heavy.pullRested, E.heavy.pull, fatigue);
  return E.droopPerFatigue * fatigue + noise + bump + heaviness * pull;
}

export interface EyesUpdate {
  state: DrowsinessState;
  /** Eyes have been closed past the grace period: a microsleep should start. */
  fellAsleep: boolean;
  waveStarted: boolean;
}

/** Advances the eyelids by `dtSec` real seconds while awake. */
export function updateEyes(prev: DrowsinessState, dtSec: number, fatigue: number, rng: Rng, noiseSeed: number): EyesUpdate {
  const s = { ...prev };
  if (s.phase !== 'awake') return { state: s, fellAsleep: false, waveStarted: false };

  s.elapsedMs += dtSec * 1000;
  s.confusedMs = Math.max(0, s.confusedMs - dtSec * 1000);

  let waveStarted = false;
  if (s.wave) {
    const wave = { ...s.wave, elapsedSec: s.wave.elapsedSec + dtSec };
    s.wave = wave.elapsedSec >= wave.durationSec ? null : wave;
  } else {
    s.nextWaveInSec -= dtSec;
    if (s.nextWaveInSec <= 0) {
      s.wave = startWave(fatigue, rng);
      s.waveCount += 1;
      s.nextWaveInSec = nextWaveGapSec(fatigue, rng);
      waveStarted = true;
    }
  }

  const target = eyelidTarget(s, fatigue, noiseSeed);
  if (target > s.eyelid) {
    s.eyelid += (target - s.eyelid) * Math.min(1, E.closeRate * dtSec);
  } else {
    // Eyes reopen on their own only slowly, and slower the more tired you are.
    s.eyelid = Math.max(target, s.eyelid - E.reopenRate * (1 - fatigue) * dtSec);
  }
  s.eyelid = clamp(s.eyelid, 0, 1);

  s.closedMs = s.eyelid >= E.closedThreshold ? s.closedMs + dtSec * 1000 : 0;
  return { state: s, fellAsleep: s.closedMs >= BALANCE.sleep.graceMs, waveStarted };
}

/** Player forces the eyes open. Rapid mashing and pressing while the eyes are still open help less. */
export function openEyes(prev: DrowsinessState, nowMs: number): DrowsinessState {
  if (prev.phase !== 'awake') return prev;
  const input = E.input;
  let factor = 1;
  if (prev.lastInputMs !== null && nowMs - prev.lastInputMs < input.spamWindowMs) factor *= input.spamFactor;
  if (prev.eyelid < input.halfClosedThreshold) factor *= input.earlyPressFactor;
  return {
    ...prev,
    eyelid: Math.max(0, prev.eyelid - input.openAmount * factor),
    closedMs: 0,
    lastInputMs: nowMs,
  };
}

/** Sudden stimulus (bright light, hard braking) opens the eyes a bit. */
export function jolt(prev: DrowsinessState, amount: number): DrowsinessState {
  if (prev.phase !== 'awake') return prev;
  return { ...prev, eyelid: Math.max(0, prev.eyelid - amount), closedMs: 0 };
}

/** Length of a microsleep in game minutes: longer when more tired. */
export function microsleepMinutes(fatigue: number, rng: Rng): number {
  const sl = BALANCE.sleep;
  const base = lerp(sl.minMinutes, sl.maxMinutes, fatigue);
  return clamp(base * rng.range(1 - sl.durationJitter, 1 + sl.durationJitter), sl.minMinutes, sl.maxMinutes);
}

export function startSleep(prev: DrowsinessState, atMin: number, durationMin: number, rng: Rng, fatigue: number): DrowsinessState {
  return {
    ...prev,
    phase: 'asleep',
    eyelid: 1,
    wave: null,
    nextWaveInSec: nextWaveGapSec(fatigue, rng),
    closedMs: 0,
    asleepMs: BALANCE.sleep.blackoutMs,
    microsleeps: prev.microsleeps + 1,
    lastMicrosleepAtMin: atMin,
    longestMicrosleepMin: Math.max(prev.longestMicrosleepMin, durationMin),
  };
}

/** Counts down the blackout; returns whether the player just woke up. */
export function updateSleep(prev: DrowsinessState, dtMs: number): { state: DrowsinessState; wokeUp: boolean } {
  if (prev.phase !== 'asleep') return { state: prev, wokeUp: false };
  const asleepMs = prev.asleepMs - dtMs;
  if (asleepMs > 0) return { state: { ...prev, asleepMs }, wokeUp: false };
  return {
    state: {
      ...prev,
      phase: 'awake',
      asleepMs: 0,
      eyelid: BALANCE.sleep.wakeEyelid,
      confusedMs: BALANCE.sleep.confusionMs,
    },
    wokeUp: true,
  };
}
