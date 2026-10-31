import type * as Phaser from 'phaser';
import type { Route } from '../core/route';
import { GameSession } from '../core/session';
import { SceneKeys } from './keys';

const REGISTRY_KEY = 'session';
const ROUTE_KEY = 'route';

/** Stores the current run in the game-wide registry so it travels between scenes. */
export function setSession(scene: Phaser.Scene, session: GameSession): void {
  scene.registry.set(REGISTRY_KEY, session);
}

export function getSession(scene: Phaser.Scene): GameSession {
  const session: unknown = scene.registry.get(REGISTRY_KEY);
  if (!(session instanceof GameSession)) throw new Error('No GameSession started');
  return session;
}

export function setRoute(scene: Phaser.Scene, route: Route): void {
  scene.registry.set(ROUTE_KEY, route);
}

export function getRoute(scene: Phaser.Scene): Route {
  const route = scene.registry.get(ROUTE_KEY) as Route | undefined;
  if (!route) throw new Error('No route loaded');
  return route;
}

/** A fresh seed for a new run: at most five digits, so it is easy to share. */
export function newSeed(): number {
  return ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) % 100_000;
}

let urlSeedUsed = false;

/** `?seed=123` in the URL reproduces a run (first run only); otherwise a fresh seed. */
export function nextSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const parsed = param === null ? NaN : Number(param);
  if (!urlSeedUsed && Number.isFinite(parsed)) {
    urlSeedUsed = true;
    return parsed >>> 0;
  }
  return newSeed();
}

/** Starts a new run on the loaded route and switches to the bus. */
export function startRun(scene: Phaser.Scene, seed = nextSeed()): void {
  // MVP: fixed starting values from BALANCE.start; later the bar phase sets them.
  setSession(scene, GameSession.start({ seed }, getRoute(scene)));
  scene.scene.start(SceneKeys.Bus);
}
