import { EventBus } from '../core/events';

/** App-level (not game) events: installation, updates, pausing. */
export type AppEvents = {
  updateAvailable: Record<string, never>;
  installAvailable: Record<string, never>;
  installed: Record<string, never>;
  pausedChanged: { paused: boolean };
};

export const appEvents = new EventBus<AppEvents>();
