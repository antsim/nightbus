import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { addModifier, createMeter, createMeters, nauseaRate, setMeterValue, updateMeters, type MeterContext, type Meters } from './meters';
import { GameSession } from './session';
import { defaultRoute } from './testing/bots';

const meters = (intoxication = 0.5, fatigue = 0.5, cold = 0.5, nausea = 0.5): Meters =>
  createMeters({ intoxication, fatigue, cold, nausea });

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

describe('nausea', () => {
  const N = BALANCE.nausea;
  const at = (eyelid: number, busPhase: MeterContext['busPhase']): MeterContext => ({ eyelid, busPhase });
  const rate = (intox: number, ctx: MeterContext) => nauseaRate(meters(intox, 0.5, 0, 0.5), ctx);

  it('rises with the eyes open in a moving bus, more when drunk', () => {
    expect(rate(0, at(0, 'driving'))).toBeCloseTo(N.openBasePerMin);
    expect(rate(0.6, at(0, 'driving'))).toBeCloseTo(N.openBasePerMin + N.openPerIntoxPerMin * 0.6);
    expect(rate(0.9, at(0, 'driving'))).toBeGreaterThan(rate(0.3, at(0, 'driving')));
  });

  it('scales with how open the eyes are', () => {
    expect(rate(0.6, at(0.5, 'driving'))).toBeCloseTo(rate(0.6, at(0, 'driving')) / 2);
  });

  it('spikes while accelerating and braking', () => {
    for (const phase of ['accelerating', 'braking'] as const) {
      expect(rate(0.6, at(0, phase)) - rate(0.6, at(0, 'driving'))).toBeCloseTo(N.motionPerMin);
    }
  });

  it('eases with the eyes closed, even while moving', () => {
    expect(rate(0.6, at(N.closedRelief.threshold + 0.05, 'braking'))).toBeLessThan(0);
    expect(rate(0.6, at(1, 'driving'))).toBeCloseTo(-N.closedRelief.perMin);
  });

  it('eases slowly in a standing bus, even with the eyes open', () => {
    expect(rate(0.9, at(0, 'dwelling'))).toBeCloseTo(-N.stillPerMin);
    expect(rate(0.9, at(1, 'dwelling'))).toBeLessThan(rate(0.9, at(0, 'dwelling')));
  });

  it('only changes through updateMeters with the given context', () => {
    const m = meters(0.6, 0.5, 0, 0.5);
    expect(updateMeters(m, [], 1, at(0, 'driving')).meters.nausea.value).toBeGreaterThan(0.5);
    expect(updateMeters(m, [], 1, at(1, 'driving')).meters.nausea.value).toBeLessThan(0.5);
    // Without context (not on a bus, eyes shut) it never rises.
    expect(updateMeters(m, [], 1).meters.nausea.value).toBeLessThanOrEqual(0.5);
  });

  it('in a ride with the same seed: rises with eyes open, falls with eyes shut and during a microsleep', () => {
    const ride = (eyelid: number | null) => {
      const s = GameSession.start({ seed: 4, nausea: 0.5 }, defaultRoute);
      while (s.state.ride.phase === 'dwelling') s.step(BALANCE.time.stepMs);
      for (let i = 0; i < 50; i++) {
        if (eyelid !== null) s.state.drowsiness = { ...s.state.drowsiness, eyelid, closedMs: 0 };
        s.step(BALANCE.time.stepMs);
      }
      return s.state.meters.nausea.value;
    };
    expect(ride(0)).toBeGreaterThan(0.5);
    expect(ride(0.9)).toBeLessThan(0.5);

    const s = GameSession.start({ seed: 4, nausea: 0.5, fatigue: 0.95 }, defaultRoute);
    let before = 0;
    while (s.state.drowsiness.microsleeps === 0 && !s.finished) {
      before = s.state.meters.nausea.value;
      s.step(BALANCE.time.stepMs);
    }
    const sleep = s.state.log.find((e) => e.type === 'microsleep');
    expect(sleep?.type).toBe('microsleep');
    if (sleep?.type !== 'microsleep') return;
    // Eased by the length of the sleep (clamped at 0).
    const eased = before - s.state.meters.nausea.value;
    expect(eased).toBeGreaterThanOrEqual(Math.min(before, N.closedRelief.perMin * sleep.data.durationMin) - 0.01);
  });
});
