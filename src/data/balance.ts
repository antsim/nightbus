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
    /** Route seconds per game second at full speed (tuned so the whole route takes 3–4 real minutes). */
    cruiseSpeed: 1.1,
    /** Game seconds standing at a stop (no rush at night). */
    dwellSec: 6,
    /** Game seconds from standstill to cruise speed. */
    accelSec: 8,
    /** Route seconds before a stop where braking starts. */
    brakeDistanceSec: 10,
    /** Lowest speed factor while moving, so the bus always reaches the stop. */
    minSpeedFactor: 0.08,
    /** Route seconds before a stop when it is announced (stopApproaching). */
    approachLeadSec: 25,
  },
  stops: {
    /**
     * Route seconds before a stop when the driver decides whether to stop:
     * braking distance plus a small margin. A request after this is too late.
     */
    requestCutoffSec: 12,
    /** Chance that someone waits at a stop (decided per stop from the run seed). */
    waitingChance: 0.3,
    /** Chance that another passenger presses the button for a stop; `busy` stops (campus, hospital) more often. */
    otherRequestChance: 0.2,
    busyOtherRequestChance: 0.5,
    /** Another passenger's request always lights up at least this long (route seconds) before the cutoff. */
    minLeadSec: 8,
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
  eyes: {
    /** How fast the eyelid follows the pull when closing (per real second). */
    closeRate: 2.2,
    /** How fast the eyes reopen on their own at fatigue 0 (eyelid units per real second). */
    reopenRate: 0.25,
    /** Constant droop at fatigue 1.0. */
    droopPerFatigue: 0.3,
    noiseAmplitude: 0.08,
    /** Noise cycles per real second. */
    noiseFrequency: 0.35,
    /** Eyelid at or above this counts as fully closed. */
    closedThreshold: 0.97,
    /**
     * Heavy eyelids: past `start` the eyes pull themselves shut (tipping point),
     * by `pull` at fatigue 1.0 (`pullRested` at fatigue 0).
     */
    heavy: { start: 0.7, pull: 0.6, pullRested: 0.15 },
    wave: {
      gapMinSec: 3,
      gapMaxSec: 8,
      /** Gap multiplier when rested / exhausted. */
      gapScaleRested: 1.6,
      gapScaleExhausted: 0.6,
      durationMinSec: 2,
      durationMaxSec: 5,
      depthBase: 0.3,
      depthPerFatigue: 0.95,
      depthJitter: 0.2,
      maxDepth: 1.4,
      /** Share of the wave spent closing (the rest is the slow release). */
      riseShare: 0.4,
    },
    input: {
      /** Eyelid reduction per press. */
      openAmount: 0.4,
      /** Opening presses closer together than this count less (anti-mashing). */
      spamWindowMs: 300,
      spamFactor: 0.3,
      /**
       * A press while the eyes are less than this closed is too early: the player
       * startles instead, the eyes close by `earlyPressPenalty` and the next wave
       * comes `earlyPressWaveAdvanceSec` sooner (or a running wave deepens).
       */
      halfClosedThreshold: 0.5,
      earlyPressPenalty: 0.1,
      earlyPressWaveAdvanceSec: 1.5,
      earlyPressWaveDepthBoost: 0.1,
      /**
       * Each startle adds jumpiness, which calms down over real time. At 1 or more
       * the player is flustered: every press startles, even with the eyes closing.
       * One mistake is forgiven; pressing on a steady beat is not.
       */
      startleJumpiness: 0.34,
      jumpinessMax: 1.5,
      jumpinessDecayPerSec: 0.2,
    },
  },
  sleep: {
    /** Eyes fully closed this long (real ms) → microsleep. */
    graceMs: 1200,
    /** Game minutes skipped, scaled by fatigue from min to max. */
    minMinutes: 1,
    maxMinutes: 6,
    durationJitter: 0.3,
    /** Real ms of darkness shown for the microsleep. */
    blackoutMs: 1800,
    wakeEyelid: 0.1,
    /** Real ms of "where am I" effects after waking. */
    confusionMs: 2000,
    /** Fatigue removed by the short sleep. */
    fatigueRecovery: 0.03,
  },
  /** How tiredness looks: vignette and blur on the camera. */
  drowsyLook: {
    vignetteRadius: { rested: 1, exhausted: 0.6, perEyelid: 0.15 },
    vignetteStrength: { rested: 0.1, exhausted: 0.5 },
    /** Blur starts above this fatigue. */
    blurFromFatigue: 0.45,
    blurMax: 0.8,
    blurPerEyelid: 0.5,
    confusionBlur: 2,
    /** Nausea: camera sway from the `sway` stage (scaled up to 1.0), green tint from `queasy`. */
    nausea: {
      swayRadians: 0.035,
      swayPx: 14,
      /** Sway cycles per real second (rotation; sideways drift is slower). */
      swayHz: 0.35,
      tintColor: 0x6fbf3f,
      tintMaxAlpha: 0.28,
    },
    /** Startle feedback: a small camera jerk and a quiver of the eyelids. */
    startle: { shakeMs: 140, shakeIntensity: 0.006, flutterAmount: 0.07, flutterMs: 300 },
  },
  wakers: {
    /** Eyelid opened by a hard brake / a street light flash. */
    brakeJolt: 0.15,
    streetLightJolt: 0.04,
    /** Brief fatigue relief after a brake jolt (modifier). */
    brakeModifier: { ratePerMin: -0.02, durationMin: 0.1 },
  },
  streetLights: {
    /** Route seconds between street lights. */
    spacingRouteSec: 9,
  },
  announcements: {
    /** Garble level = intox × intoxWeight + fatigue × fatigueWeight − clearBelow, clamped to 0..1. */
    intoxWeight: 0.8,
    fatigueWeight: 0.4,
    clearBelow: 0.2,
    /** Reading the display is easier than hearing the speaker. */
    displayLevelFactor: 0.6,
    /** Real ms the subtitle stays on screen. */
    subtitleMs: 4500,
    /** Display shows a wrong stop briefly when intoxication is above this. */
    flickerFromIntox: 0.45,
    /** Chance per real second of a flicker at intoxication 1.0. */
    flickerPerSec: 0.8,
    flickerMs: 350,
    garble: {
      /** Share of garbled syllables replaced with a filler (the rest lose letters). */
      replaceShare: 0.5,
      /** Garble weight of the last syllable relative to the first. */
      endWeight: 0.35,
      cutWordChance: 0.35,
      /** Share of syllables kept when a word is cut. */
      cutKeepShare: 0.4,
      fillers: ['mm', 'mmh', 'rrh', 'hh', '…', 'öö', 'nn'],
    },
  },
  score: {
    /** Points for getting off at home; other outcomes start from here too. */
    base: 1000,
    wrongStopPenalty: 150,
    terminusPenalty: 200,
    awakeBonusPerMin: 10,
    microsleepPenalty: 50,
    /** Forced off the bus by nausea. */
    sickPenalty: 250,
    /** Humorous lines on the receipt. */
    maxLines: 3,
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
  nausea: {
    /** Eyes open in a moving bus, scaled by how open the eyes are (1 − eyelid). */
    openBasePerMin: 0.04,
    openPerIntoxPerMin: 0.15,
    /** Extra while the bus accelerates or brakes, also scaled by (1 − eyelid). */
    motionPerMin: 0.15,
    /** Eyes this closed (or asleep) give relief. */
    closedRelief: { threshold: 0.7, perMin: 0.6 },
    /** Recovery while the bus stands still, eyes open or not. */
    stillPerMin: 0.03,
    /** Warning stages: camera sway from `sway`, green tint and a subtitle from `queasy`. */
    warn: { sway: 0.6, queasy: 0.8 },
  },
  cold: {
    /** Inside the bus it is warm; outdoor phases add cold via modifiers. */
    basePerMin: 0,
  },
  start: {
    intoxication: 0.6,
    fatigue: 0.5,
    cold: 0,
    nausea: 0,
    /** Euro cents. */
    money: 2500,
    time: '02:10',
    routeId: 'bus-nro6',
  },
} as const;
