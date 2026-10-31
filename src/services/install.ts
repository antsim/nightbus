import { appEvents } from './appEvents';

/** Chrome/Edge/Android install prompt event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    appEvents.emit('installAvailable', {});
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    appEvents.emit('installed', {});
  });
}

/** iPhone/iPad, including iPadOS that reports itself as a Mac. */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Running as an installed app (home screen / installed PWA). */
export function isInstalled(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches;
}

export type InstallOption = 'prompt' | 'iosInstructions' | 'none';

export function installOption(): InstallOption {
  if (isInstalled()) return 'none';
  if (deferredPrompt) return 'prompt';
  if (isIos(navigator.userAgent, navigator.maxTouchPoints)) return 'iosInstructions';
  return 'none';
}

export async function promptInstall(): Promise<void> {
  const prompt = deferredPrompt;
  if (!prompt) return;
  deferredPrompt = null;
  await prompt.prompt();
  await prompt.userChoice;
}
