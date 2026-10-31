import { STR } from '../data/strings.fi';
import { appEvents } from './appEvents';
import { PauseReasons } from './pauseReasons';

const reasons = new PauseReasons();
const PORTRAIT_TOUCH = '(orientation: portrait) and (pointer: coarse)';

function update(reason: 'hidden' | 'portrait', on: boolean): void {
  if (reasons.set(reason, on)) appEvents.emit('pausedChanged', { paused: reasons.paused });
}

/**
 * Pauses the game when the page is hidden (call, app switch) or a phone is
 * held upright. The "turn your phone" screen itself is CSS (index.html).
 */
export function initLifecycle(): void {
  const text = document.querySelector('#rotate .text');
  if (text) text.textContent = STR.app.rotate;

  document.addEventListener('visibilitychange', () => update('hidden', document.hidden));
  const portrait = matchMedia(PORTRAIT_TOUCH);
  portrait.addEventListener('change', (e) => update('portrait', e.matches));
  update('hidden', document.hidden);
  update('portrait', portrait.matches);
}

export function isPaused(): boolean {
  return reasons.paused;
}
