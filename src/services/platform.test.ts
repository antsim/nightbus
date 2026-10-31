import { describe, expect, it } from 'vitest';
import { isIos } from './install';
import { PauseReasons } from './pauseReasons';

describe('PauseReasons', () => {
  it('pauses while any reason is active and reports only real changes', () => {
    const p = new PauseReasons();
    expect(p.paused).toBe(false);
    expect(p.set('hidden', true)).toBe(true);
    expect(p.set('portrait', true)).toBe(false); // already paused
    expect(p.set('hidden', false)).toBe(false); // still upright
    expect(p.paused).toBe(true);
    expect(p.set('portrait', false)).toBe(true);
    expect(p.paused).toBe(false);
  });

  it('ignores repeated identical updates', () => {
    const p = new PauseReasons();
    p.set('hidden', true);
    expect(p.set('hidden', true)).toBe(false);
  });
});

describe('isIos', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 5, true],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 5, true], // iPadOS
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', 0, false], // Mac
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile', 5, false],
  ])('%s (%i touch points) → %s', (ua, touch, expected) => {
    expect(isIos(ua, touch)).toBe(expected);
  });
});
