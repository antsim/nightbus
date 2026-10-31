// All tuning numbers (speeds, rates, multipliers) live here.
// Rates are per game minute unless stated otherwise.
export const BALANCE = {
  time: {
    /** Fixed logic step in real milliseconds. */
    stepMs: 100,
    /** Game minutes per real second. */
    timeScale: 6,
    /** Longest real frame processed at once (e.g. after the tab was hidden). */
    maxFrameMs: 250,
    /** Debug fast-forward multiplier (F2). */
    debugSpeedMultiplier: 4,
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
    routeId: 'home-night-bus',
  },
} as const;
