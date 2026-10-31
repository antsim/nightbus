import { BALANCE } from '../data/balance';
import { clamp } from './math';

export const METER_IDS = ['intoxication', 'fatigue', 'cold'] as const;
export type MeterId = (typeof METER_IDS)[number];

export interface Meter {
  value: number;
  min: number;
  max: number;
}

export type Meters = Record<MeterId, Meter>;

/** Temporary change to a meter's rate, e.g. coffee lowers fatigue for 10 minutes. */
export interface Modifier {
  id: string;
  meter: MeterId;
  ratePerMin: number;
  /** Omit for a modifier that lasts until removed. */
  durationMin?: number;
}

export interface ActiveModifier {
  id: string;
  meter: MeterId;
  ratePerMin: number;
  /** null = permanent. */
  remainingMin: number | null;
}

export function createMeter(value: number, min = 0, max = 1): Meter {
  return { value: clamp(value, min, max), min, max };
}

export function setMeterValue(meter: Meter, value: number): Meter {
  return { ...meter, value: clamp(value, meter.min, meter.max) };
}

export function createMeters(values: Record<MeterId, number>): Meters {
  return {
    intoxication: createMeter(values.intoxication),
    fatigue: createMeter(values.fatigue),
    cold: createMeter(values.cold),
  };
}

export function activateModifier(modifier: Modifier): ActiveModifier {
  return {
    id: modifier.id,
    meter: modifier.meter,
    ratePerMin: modifier.ratePerMin,
    remainingMin: modifier.durationMin ?? null,
  };
}

/** Adds a modifier, replacing any existing one with the same id (no stacking). */
export function addModifier(modifiers: readonly ActiveModifier[], modifier: Modifier): ActiveModifier[] {
  return [...modifiers.filter((m) => m.id !== modifier.id), activateModifier(modifier)];
}

/** Base rates per game minute, including dependencies between meters. */
export function baseRates(meters: Meters): Record<MeterId, number> {
  return {
    intoxication: -BALANCE.intoxication.decayPerMin,
    fatigue: BALANCE.fatigue.basePerMin + BALANCE.fatigue.perIntoxPerMin * meters.intoxication.value,
    cold: BALANCE.cold.basePerMin,
  };
}

export interface MeterUpdate {
  meters: Meters;
  modifiers: ActiveModifier[];
  expired: ActiveModifier[];
}

/**
 * Advances meters by `dtMin` game minutes: base rate + dependencies + modifiers.
 * A modifier that expires mid-step only contributes for its remaining time.
 */
export function updateMeters(meters: Meters, modifiers: readonly ActiveModifier[], dtMin: number): MeterUpdate {
  const delta = baseRates(meters);
  for (const id of METER_IDS) delta[id] *= dtMin;

  const kept: ActiveModifier[] = [];
  const expired: ActiveModifier[] = [];
  for (const mod of modifiers) {
    const activeMin = mod.remainingMin === null ? dtMin : Math.min(dtMin, mod.remainingMin);
    delta[mod.meter] += mod.ratePerMin * activeMin;

    if (mod.remainingMin === null) {
      kept.push(mod);
    } else if (mod.remainingMin > dtMin) {
      kept.push({ ...mod, remainingMin: mod.remainingMin - dtMin });
    } else {
      expired.push(mod);
    }
  }

  const next = { ...meters };
  for (const id of METER_IDS) next[id] = setMeterValue(meters[id], meters[id].value + delta[id]);
  return { meters: next, modifiers: kept, expired };
}
