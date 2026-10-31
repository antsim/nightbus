import type { ActiveModifier, MeterId } from './meters';

/** All game events and their payloads. Payloads must be plain JSON data. */
export type GameEvents = {
  runStarted: { seed: number; routeId: string };
  modifierAdded: { modifier: ActiveModifier };
  modifierExpired: { id: string; meter: MeterId };
  timeScaleChanged: { timeScale: number };
};

export type GameEventName = keyof GameEvents;

type Handler<P> = (payload: P) => void;

/** Typed pub/sub. State is the source of truth; events only announce changes. */
export class EventBus<E extends Record<string, unknown> = GameEvents> {
  private readonly handlers = new Map<keyof E, Set<Handler<never>>>();

  /** Returns an unsubscribe function. */
  on<K extends keyof E>(name: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(name, handler);
  }

  once<K extends keyof E>(name: K, handler: Handler<E[K]>): () => void {
    const off = this.on(name, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof E>(name: K, handler: Handler<E[K]>): void {
    this.handlers.get(name)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof E>(name: K, payload: E[K]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const handler of [...set]) (handler as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
