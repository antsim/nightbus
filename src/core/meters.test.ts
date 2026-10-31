import { describe, expect, it } from 'vitest';
import { addModifier, createMeter, createMeters, setMeterValue, updateMeters, type Meters } from './meters';

const meters = (intoxication = 0.5, fatigue = 0.5, cold = 0.5): Meters =>
  createMeters({ intoxication, fatigue, cold });

describe('meters', () => {
  it('clamps on creation and on set', () => {
    expect(createMeter(1.5).value).toBe(1);
    expect(setMeterValue(createMeter(0.5), -3).value).toBe(0);
  });

  it('stays within bounds over long updates', () => {
    let m = meters(1, 1, 1);
    let mods = addModifier([], { id: 'heater', meter: 'cold', ratePerMin: 5 });
    for (let i = 0; i < 1000; i++) {
      ({ meters: m, modifiers: mods } = updateMeters(m, mods, 1));
    }
    for (const meter of Object.values(m)) {
      expect(meter.value).toBeGreaterThanOrEqual(0);
      expect(meter.value).toBeLessThanOrEqual(1);
    }
    expect(m.fatigue.value).toBe(1);
    expect(m.cold.value).toBe(1);
  });

  it('decays intoxication and raises fatigue on its own', () => {
    const { meters: next } = updateMeters(meters(), [], 10);
    expect(next.intoxication.value).toBeLessThan(0.5);
    expect(next.fatigue.value).toBeGreaterThan(0.5);
  });

  it('applies a modifier only for its duration', () => {
    let m = meters(0, 0.5, 0.5);
    let mods = addModifier([], { id: 'coffee', meter: 'fatigue', ratePerMin: -0.05, durationMin: 10 });
    const withoutCoffee = updateMeters(meters(0, 0.5, 0.5), [], 4).meters.fatigue.value;

    // 4 + 4 + 4 minutes: the modifier expires during the third step (2 min left).
    const expiredAt: number[] = [];
    for (let step = 0; step < 3; step++) {
      const res = updateMeters(m, mods, 4);
      m = res.meters;
      mods = res.modifiers;
      if (res.expired.length > 0) expiredAt.push(step);
    }

    expect(expiredAt).toEqual([2]);
    expect(mods).toEqual([]);
    // Total effect: 10 min × -0.05 = -0.5 on top of the base rate for 12 min.
    const baseFor12 = (withoutCoffee - 0.5) * 3;
    expect(m.fatigue.value).toBeCloseTo(Math.max(0, 0.5 + baseFor12 - 0.5));
  });

  it('counts down remaining time', () => {
    const mods = addModifier([], { id: 'kebab', meter: 'intoxication', ratePerMin: -0.01, durationMin: 10 });
    const res = updateMeters(meters(), mods, 3);
    expect(res.modifiers[0]?.remainingMin).toBeCloseTo(7);
  });

  it('keeps permanent modifiers', () => {
    const mods = addModifier([], { id: 'wind', meter: 'cold', ratePerMin: 0.01 });
    const res = updateMeters(meters(), mods, 1000);
    expect(res.modifiers).toHaveLength(1);
    expect(res.expired).toHaveLength(0);
  });

  it('replaces a modifier with the same id instead of stacking', () => {
    let mods = addModifier([], { id: 'coffee', meter: 'fatigue', ratePerMin: -0.05, durationMin: 10 });
    mods = addModifier(mods, { id: 'coffee', meter: 'fatigue', ratePerMin: -0.05, durationMin: 10 });
    expect(mods).toHaveLength(1);
  });
});
