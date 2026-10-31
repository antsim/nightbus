import type * as Phaser from 'phaser';
import type { Route } from '../core/route';
import { GameSession } from '../core/session';

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

/** `?seed=123` in the URL reproduces a run; otherwise a fresh seed. */
export function seedFromUrl(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const parsed = param === null ? NaN : Number(param);
  return Number.isFinite(parsed) ? parsed >>> 0 : Date.now() >>> 0;
}
