import { registerSW } from 'virtual:pwa-register';
import { appEvents } from './appEvents';

let updateServiceWorker: ((reload?: boolean) => Promise<void>) | null = null;
let updateReady = false;

/** Registers the service worker. A new version only announces itself; it is applied on request. */
export function initPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  updateServiceWorker = registerSW({
    onNeedRefresh() {
      updateReady = true;
      appEvents.emit('updateAvailable', {});
    },
    onRegisterError(err: unknown) {
      console.warn('Service worker registration failed', err);
    },
  });
}

export function isUpdateReady(): boolean {
  return updateReady;
}

/** Activates the waiting version and reloads. Only call from menus, never mid-ride. */
export function applyUpdate(): void {
  void updateServiceWorker?.(true);
}
