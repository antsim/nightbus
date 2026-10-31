// Keeps the screen on during the bus ride where supported; silently does nothing elsewhere.

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  if (!wanted || sentinel || document.hidden || !('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    // Not allowed (e.g. low battery mode): ignore.
  }
}

// The lock is released automatically when the page is hidden; take it again on return.
document.addEventListener('visibilitychange', () => void acquire());

export function keepScreenOn(on: boolean): void {
  wanted = on;
  if (on) {
    void acquire();
  } else {
    void sentinel?.release();
    sentinel = null;
  }
}
