import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { formatTime } from './clock';
import { GameSession } from './session';

const start = (intoxication: number) =>
  GameSession.start({ seed: 1, intoxication, fatigue: 0.2, startTime: '02:10' });

describe('GameSession', () => {
  it('advances in fixed steps regardless of frame rate', () => {
    const at60fps = start(0.5);
    const at20fps = start(0.5);
    for (let i = 0; i < 600; i++) at60fps.tick(1000 / 60);
    for (let i = 0; i < 200; i++) at20fps.tick(50);
    expect(at60fps.state.clock.minutes).toBeCloseTo(at20fps.state.clock.minutes, 6);
    expect(at60fps.state.meters).toEqual(at20fps.state.meters);
    expect(formatTime(at60fps.state.clock.minutes)).toBe('03:10');
  });

  it('caps very long frames', () => {
    const session = start(0.5);
    session.tick(60_000);
    const maxMin = (BALANCE.time.maxFrameMs / 1000) * BALANCE.time.timeScale;
    expect(session.state.clock.minutes - 130).toBeLessThanOrEqual(maxMin);
  });

  it('raises fatigue faster when more intoxicated over 30 game minutes', () => {
    const sober = start(0.1);
    const drunk = start(0.9);
    sober.simulateMinutes(30);
    drunk.simulateMinutes(30);
    expect(formatTime(drunk.state.clock.minutes)).toBe('02:40');
    const soberGain = sober.state.meters.fatigue.value - 0.2;
    const drunkGain = drunk.state.meters.fatigue.value - 0.2;
    expect(soberGain).toBeGreaterThan(0);
    expect(drunkGain).toBeGreaterThan(soberGain * 1.5);
  });

  it('logs and emits modifier lifecycle', () => {
    const session = start(0.5);
    const expired: string[] = [];
    session.bus.on('modifierExpired', ({ id }) => expired.push(id));
    session.addModifier({ id: 'coffee', meter: 'fatigue', ratePerMin: -0.05, durationMin: 5 });
    session.simulateMinutes(6);
    expect(expired).toEqual(['coffee']);
    expect(session.state.log.map((e) => e.type)).toEqual(['runStarted', 'modifierAdded', 'modifierExpired']);
  });

  it('is deterministic for the same seed', () => {
    const a = GameSession.start({ seed: 123 });
    const b = GameSession.start({ seed: 123 });
    a.simulateMinutes(10);
    b.simulateMinutes(10);
    expect([a.rng.next(), a.rng.next()]).toEqual([b.rng.next(), b.rng.next()]);
    expect(a.state).toEqual(b.state);
  });

  it('round-trips RunState through JSON without loss', () => {
    const session = start(0.6);
    session.addModifier({ id: 'coffee', meter: 'fatigue', ratePerMin: -0.05, durationMin: 10 });
    session.addModifier({ id: 'wind', meter: 'cold', ratePerMin: 0.01 });
    session.simulateMinutes(3);
    session.rng.next();

    const json = JSON.stringify(session);
    expect(JSON.parse(json)).toEqual(session.state);

    // A restored session continues identically.
    const restored = GameSession.fromJSON(json);
    session.simulateMinutes(5);
    restored.simulateMinutes(5);
    expect(restored.state).toEqual(session.state);
    expect(restored.rng.next()).toBe(session.rng.next());
  });
});
