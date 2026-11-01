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

/** Never presses. */
export function idleBot(): Bot {
  return { name: 'idle', start: () => () => false };
}

/** A reasonably attentive player; reliably stays awake on the default route. */
export const attentiveBot = (): Bot => reactiveBot(0.55, 400);

export interface DriveOptions {
  /** Press the stop button once the bus has left this stop index. */
  stopAt?: number;
  /** Simulated real time limit. */
  maxMs?: number;
}

/** Plays `session` with `bot` until the run finishes (or `maxMs`). */
export function driveBot(session: GameSession, bot: Bot, { stopAt, maxMs = 10 * 60_000 }: DriveOptions = {}): GameSession {
  const policy = bot.start();
  const step = BALANCE.time.stepMs;
  for (let ms = step; !session.finished && ms <= maxMs; ms += step) {
    session.step(step);
    if (session.finished) break;
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
export function runBot(bot: Bot, { seed, stopAt, maxMs, route = defaultRoute, ...init }: RunBotOptions): RunState {
  const drive: DriveOptions = {};
  if (stopAt !== undefined) drive.stopAt = stopAt;
  if (maxMs !== undefined) drive.maxMs = maxMs;
  return driveBot(GameSession.start({ seed, ...init }, route), bot, drive).state;
}

/** The first microsleep happened before the bus reached the home stop with the player awake. */
export function sleptBeforeHome(state: RunState, route: Route = defaultRoute): boolean {
  const homeId = route.stops.find((s) => s.isHome)?.id;
  const sleep = state.log.findIndex((e) => e.type === 'microsleep');
  const home = state.log.findIndex((e) => e.type === 'stopReached' && e.data.stopId === homeId);
  return sleep >= 0 && (home < 0 || sleep < home);
}
