export type PauseReason = 'hidden' | 'portrait';

/** Tracks why the game should be paused; it runs only when no reason is active. */
export class PauseReasons {
  private readonly active = new Set<PauseReason>();

  /** Returns true if the overall paused state changed. */
  set(reason: PauseReason, on: boolean): boolean {
    const before = this.paused;
    if (on) this.active.add(reason);
    else this.active.delete(reason);
    return before !== this.paused;
  }

  get paused(): boolean {
    return this.active.size > 0;
  }
}
