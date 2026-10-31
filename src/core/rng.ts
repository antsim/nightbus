// Seeded RNG (mulberry32). All game randomness must go through this so runs
// are reproducible and testable.

export interface RngStateHolder {
  rngState: number;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

/** Normalises any number into a valid 32-bit RNG state. */
export function seedToState(seed: number): number {
  return seed >>> 0;
}

/**
 * RNG that reads and writes its state on `holder`, so the state can live in
 * a serialisable object such as RunState.
 */
export function rngFrom(holder: RngStateHolder): Rng {
  const next = (): number => {
    holder.rngState = (holder.rngState + 0x6d2b79f5) >>> 0;
    let t = holder.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
  };
}

export function createRng(seed: number): Rng {
  return rngFrom({ rngState: seedToState(seed) });
}
