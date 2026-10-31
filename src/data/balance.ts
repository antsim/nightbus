// All tuning numbers (speeds, rates, multipliers) live here.
// Rates are per game minute unless stated otherwise.
export const BALANCE = {
  time: {
    /** Fixed logic step in real milliseconds. */
    stepMs: 100,
    /**
     * Game minutes per real second. 0.14 ≈ 8.4 game seconds per second, so the
     * ~30 game-minute line 6 ride takes about 3.6 minutes of real time.
     */
    timeScale: 0.14,
    /** Longest real frame processed at once (e.g. after the tab was hidden). */
    maxFrameMs: 250,
    /** Debug fast-forward multiplier (F2). */
    debugSpeedMultiplier: 4,
  },
  bus: {
    /** Route seconds per game second at full speed (>1 makes up for dwell time). */
    cruiseSpeed: 1.6,
    /** Game seconds standing at each stop. */
    dwellSec: 15,
    /** Game seconds from standstill to cruise speed. */
    accelSec: 8,
    /** Route seconds before a stop where braking starts. */
    brakeDistanceSec: 10,
    /** Lowest speed factor while moving, so the bus always reaches the stop. */
    minSpeedFactor: 0.08,
    /** Route seconds before a stop when it is announced (stopApproaching). */
    approachLeadSec: 25,
  },
  scenery: {
    /** Screen pixels per route second for the nearest layer. */
    pxPerRouteSec: 37,
    /** Parallax factors relative to the nearest layer. */
    layerFactors: { far: 0.2, mid: 0.5, near: 1 },
    /** Landmarks on the far side of the road move like the mid layer. */
    farSideFactor: 0.5,
    shake: {
      durationMs: 220,
      intensity: 0.0015,
      /** Extra intensity at intoxication 1.0 (multiplier). */
      perIntox: 2,
    },
  },
  intoxication: {
    /** Intoxication wears off slowly over time. */
    decayPerMin: 0.003,
  },
  fatigue: {
    basePerMin: 0.004,
    /** Extra fatigue per minute at intoxication 1.0. */
    perIntoxPerMin: 0.01,
  },
  cold: {
    /** Inside the bus it is warm; outdoor phases add cold via modifiers. */
    basePerMin: 0,
  },
  start: {
    intoxication: 0.6,
    fatigue: 0.4,
    cold: 0,
    /** Euro cents. */
    money: 2500,
    time: '02:10',
    routeId: 'bus-nro6',
  },
} as const;
