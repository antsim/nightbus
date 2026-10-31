// Smooth 1D value noise: random values on integer lattice points, smoothly
// interpolated in between. Deterministic for a given seed, stateless.

function hash(seed: number, i: number): number {
  let h = (Math.imul(i, 0x27d4eb2d) ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Noise in [-1, 1] at position `x`. */
export function valueNoise1D(seed: number, x: number): number {
  const i = Math.floor(x);
  const t = smoothstep(x - i);
  const a = hash(seed, i);
  const b = hash(seed, i + 1);
  return (a + (b - a) * t) * 2 - 1;
}
