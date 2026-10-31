import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './events';

describe('EventBus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('timeScaleChanged', handler);
    bus.emit('timeScaleChanged', { timeScale: 4 });
    off();
    bus.emit('timeScaleChanged', { timeScale: 8 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ timeScale: 4 });
  });

  it('once fires a single time', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('modifierExpired', handler);
    bus.emit('modifierExpired', { id: 'a', meter: 'cold' });
    bus.emit('modifierExpired', { id: 'b', meter: 'cold' });
    expect(handler).toHaveBeenCalledOnce();
  });
});
