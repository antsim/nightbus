// Test-only players for balance metrics and play-through tests. Not used by the game.
// Bots see only RunState and simulated time (no Math.random), so runs are reproducible.
import { BALANCE } from '../../data/balance';
import routeData from '../../data/routes/bus-nro6.json';
import { parseRoute, type Route } from '../route';
import type { RunInit, RunState } from '../runState';
import { GameSession } from '../session';

export const defaultRoute: Route = parseRoute(routeData);

/** Decides each step whether to press openEyes. `nowMs` is simulated real time since the start. */
export type BotPolicy = (state: RunState, nowMs: number) => boolean;

/** A bot starts a fresh policy per run, so its memory never leaks between runs. */
export interface Bot {
  name: string;
  start(): BotPolicy;
}

/** Presses at a steady rhythm regardless of the eyes: the metronome player. */
export function rhythmBot(intervalMs: number): Bot {
  return {
    name: `rhythm(${intervalMs})`,
    start: () => {
      let last = -Infinity;
      return (_state, nowMs) => {
        if (nowMs - last < intervalMs) return false;
        last = nowMs;
        return true;
      };
    },
  };
}

/** Notices the eyes closing past `threshold` and presses `reactionMs` later. */
export function reactiveBot(threshold: number, reactionMs: number): Bot {
  return {
    name: `reactive(${threshold}, ${reactionMs})`,
    start: () => {
      let pressAt: number | null = null;
      return (state, nowMs) => {
        const d = state.drowsiness;
        if (d.phase !== 'awake') {
          pressAt = null;
          return false;
        }
        if (pressAt === null) {
          if (d.eyelid > threshold) pressAt = nowMs + reactionMs;
          return false;
        }
        if (nowMs < pressAt) return false;
        pressAt = null;
        return true;
      };
    },
  };
}

/**
 * Plays like `reactiveBot`, but when nausea passes `nauseaAbove` it lets the
 * eyes close and keeps them shut for `restMs` before opening them again. While
 * resting it only presses if the eyes have been fully closed for `dangerMs`
 * (a microsleep is near).
 */
export function nauseaAwareBot({
  nauseaAbove = 0.6,
  restMs = 2000,
  dangerMs = 500,
  threshold = 0.55,
  reactionMs = 400,
}: { nauseaAbove?: number; restMs?: number; dangerMs?: number; threshold?: number; reactionMs?: number } = {}): Bot {
  return {
    name: `nauseaAware(${nauseaAbove}, ${restMs})`,
    start: () => {
      const reactive = reactiveBot(threshold, reactionMs).start();
      let resting = false;
      let shutSince: number | null = null;
      let pressAt: number | null = null;
      return (state, nowMs) => {
        const d = state.drowsiness;
        if (!resting && state.meters.nausea.value > nauseaAbove) {
          resting = true;
          shutSince = null;
          pressAt = null;
        }
        if (!resting) return reactive(state, nowMs);

        if (d.shutMs > 0) shutSince ??= nowMs - d.shutMs;
        if (shutSince !== null && nowMs - shutSince >= restMs) {
          resting = false;
          return reactive(state, nowMs);
        }
        if (pressAt === null) {
          if (d.phase === 'awake' && d.closedMs >= dangerMs) pressAt = nowMs + reactionMs;
          return false;
        }
        if (nowMs < pressAt) return false;
        pressAt = null;
        shutSince = null;
        return true;
      };
    },
  };
}

/** Never presses. */
export function idleBot(): Bot {
  return { name: 'idle', start: () => () => false };
}

/** A good player: times the presses and rests the eyes when nauseous. Reliably gets home awake. */
export const attentiveBot = (): Bot => nauseaAwareBot();

export interface DriveOptions {
  /** Press the stop button once the bus has left this stop index. */
  stopAt?: number;
  /** Simulated real time limit. */
  maxMs?: number;
  /** Stop driving (without finishing the run) once this holds. */
  until?: (state: RunState) => boolean;
}

/** Plays `session` with `bot` until the run finishes (or `maxMs`). */
export function driveBot(session: GameSession, bot: Bot, { stopAt, maxMs = 10 * 60_000, until }: DriveOptions = {}): GameSession {
  const policy = bot.start();
  const step = BALANCE.time.stepMs;
  for (let ms = step; !session.finished && ms <= maxMs; ms += step) {
    session.step(step);
    if (session.finished || until?.(session.state)) break;
    if (policy(session.state, ms)) session.handleInput('openEyes');
    const r = session.state.ride;
    if (stopAt !== undefined && r.stopIndex === stopAt && r.phase !== 'dwelling') session.handleInput('requestStop');
  }
  return session;
}

export interface RunBotOptions extends DriveOptions, Omit<RunInit, 'seed' | 'routeId'> {
  seed: number;
  route?: Route;
}

/** Plays a whole run with `bot` and returns its final state. */
export function runBot(bot: Bot, { seed, stopAt, maxMs, until, route = defaultRoute, ...init }: RunBotOptions): RunState {
  const drive: DriveOptions = {};
  if (stopAt !== undefined) drive.stopAt = stopAt;
  if (maxMs !== undefined) drive.maxMs = maxMs;
  if (until !== undefined) drive.until = until;
  return driveBot(GameSession.start({ seed, ...init }, route), bot, drive).state;
}

/** The first microsleep happened before the bus reached the home stop with the player awake. */
export function sleptBeforeHome(state: RunState, route: Route = defaultRoute): boolean {
  const homeId = route.stops.find((s) => s.isHome)?.id;
  const sleep = state.log.findIndex((e) => e.type === 'microsleep');
  const home = state.log.findIndex((e) => e.type === 'stopReached' && e.data.stopId === homeId);
  return sleep >= 0 && (home < 0 || sleep < home);
}
