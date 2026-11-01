import { BALANCE } from '../data/balance';
import type { BusPhase } from './busRide';
import { clamp } from './math';

export const METER_IDS = ['intoxication', 'fatigue', 'cold', 'nausea'] as const;
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
    nausea: createMeter(values.nausea),
  };
}

/** What the player is doing right now, for rates that depend on more than the meters. */
export interface MeterContext {
  /** 0 = eyes open, 1 = closed (asleep counts as closed). */
  eyelid: number;
  /** null = not on a bus. */
  busPhase: BusPhase | null;
}

/** Eyes closed, not on a bus: nothing moves past the eyes. */
export const RESTING: MeterContext = { eyelid: 1, busPhase: null };

/**
 * Nausea per game minute. Watching the scenery roll by while drunk makes it
 * worse, accelerating and braking even more; closing the eyes or standing
 * still helps.
 */
export function nauseaRate(meters: Meters, ctx: MeterContext): number {
  const n = BALANCE.nausea;
  const open = 1 - clamp(ctx.eyelid, 0, 1);
  const moving = ctx.busPhase !== null && ctx.busPhase !== 'dwelling' && ctx.busPhase !== 'finished';
  let rate = 0;
  if (moving) {
    rate += (n.openBasePerMin + n.openPerIntoxPerMin * meters.intoxication.value) * open;
    if (ctx.busPhase === 'accelerating' || ctx.busPhase === 'braking') rate += n.motionPerMin * open;
  } else {
    rate -= n.stillPerMin;
  }
  if (ctx.eyelid > n.closedRelief.threshold) rate -= n.closedRelief.perMin;
  return rate;
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

/** Base rates per game minute, including dependencies between meters and on the player's situation. */
export function baseRates(meters: Meters, ctx: MeterContext = RESTING): Record<MeterId, number> {
  return {
    intoxication: -BALANCE.intoxication.decayPerMin,
    fatigue: BALANCE.fatigue.basePerMin + BALANCE.fatigue.perIntoxPerMin * meters.intoxication.value,
    cold: BALANCE.cold.basePerMin,
    nausea: nauseaRate(meters, ctx),
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
export function updateMeters(
  meters: Meters,
  modifiers: readonly ActiveModifier[],
  dtMin: number,
  ctx: MeterContext = RESTING,
): MeterUpdate {
  const delta = baseRates(meters, ctx);
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
