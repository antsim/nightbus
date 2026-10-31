import type * as Phaser from 'phaser';
import { GameSession } from '../core/session';

const REGISTRY_KEY = 'session';

/** Stores the current run in the game-wide registry so it travels between scenes. */
export function setSession(scene: Phaser.Scene, session: GameSession): void {
  scene.registry.set(REGISTRY_KEY, session);
}

export function getSession(scene: Phaser.Scene): GameSession {
  const session: unknown = scene.registry.get(REGISTRY_KEY);
  if (!(session instanceof GameSession)) throw new Error('No GameSession started');
  return session;
}

/** `?seed=123` in the URL reproduces a run; otherwise a fresh seed. */
export function seedFromUrl(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const parsed = param === null ? NaN : Number(param);
  return Number.isFinite(parsed) ? parsed >>> 0 : Date.now() >>> 0;
}
