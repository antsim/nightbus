import { describe, expect, it } from 'vitest';
import {
  homeStop,
  nextStop,
  parseRoute,
  previousStop,
  RouteValidationError,
  routeDuration,
  stopAtOffset,
  stopsBetween,
  type Route,
} from './route';

const stop = (id: string, offsetSec: number, extra: object = {}) => ({
  id,
  name: id.toUpperCase(),
  lat: 60,
  lon: 25,
  offsetSec,
  ...extra,
});

const validRouteData = () => ({
  id: 'test',
  lineName: 'N1',
  headsign: 'C',
  stops: [stop('a', 0), stop('b', 100, { isHome: true }), stop('c', 200, { isTerminus: true })],
  landmarks: [{ id: 'lm', name: 'Torni', sprite: 'tower', atOffsetSec: 50, side: 'left', hintForStopId: 'b' }],
});

const route: Route = parseRoute(validRouteData());

describe('parseRoute', () => {
  it('accepts a valid route', () => {
    expect(route.stops).toHaveLength(3);
  });

  it.each([
    ['no home stop', (d: ReturnType<typeof validRouteData>) => delete (d.stops[1] as { isHome?: boolean }).isHome, /exactly one stop must have isHome/],
    ['two home stops', (d: ReturnType<typeof validRouteData>) => Object.assign(d.stops[0]!, { isHome: true }), /found 2/],
    ['last stop not terminus', (d: ReturnType<typeof validRouteData>) => delete (d.stops[2] as { isTerminus?: boolean }).isTerminus, /last stop must have isTerminus/],
    ['terminus in the middle', (d: ReturnType<typeof validRouteData>) => Object.assign(d.stops[0]!, { isTerminus: true }), /only the last stop/],
    ['unsorted offsets', (d: ReturnType<typeof validRouteData>) => (d.stops[1]!.offsetSec = 300), /strictly increasing/],
    ['duplicate stop id', (d: ReturnType<typeof validRouteData>) => (d.stops[1]!.id = 'a'), /duplicate stop id/],
    ['unknown hint stop', (d: ReturnType<typeof validRouteData>) => (d.landmarks[0]!.hintForStopId = 'x'), /unknown stop "x"/],
    ['landmark past terminus', (d: ReturnType<typeof validRouteData>) => (d.landmarks[0]!.atOffsetSec = 999), /past the terminus/],
    ['bad side', (d: ReturnType<typeof validRouteData>) => (d.landmarks[0]!.side = 'up'), /side/],
    ['missing name', (d: ReturnType<typeof validRouteData>) => delete (d.stops[0] as { name?: string }).name, /name/],
  ])('rejects %s with a clear message', (_label, mutate, message) => {
    const data = validRouteData();
    mutate(data);
    expect(() => parseRoute(data, 'broken.json')).toThrow(RouteValidationError);
    expect(() => parseRoute(data, 'broken.json')).toThrow(message);
    expect(() => parseRoute(data, 'broken.json')).toThrow(/broken\.json/);
  });
});

describe('route helpers', () => {
  it('stopAtOffset finds a stop exactly or within tolerance', () => {
    expect(stopAtOffset(route, 100)?.id).toBe('b');
    expect(stopAtOffset(route, 103)).toBeUndefined();
    expect(stopAtOffset(route, 103, 5)?.id).toBe('b');
    expect(stopAtOffset(route, -10)).toBeUndefined();
    expect(stopAtOffset(route, 500)).toBeUndefined();
  });

  it('nextStop handles before-first, between, on-stop and after-last', () => {
    expect(nextStop(route, -10)?.id).toBe('a');
    expect(nextStop(route, 0)?.id).toBe('b');
    expect(nextStop(route, 150)?.id).toBe('c');
    expect(nextStop(route, 200)).toBeUndefined();
    expect(nextStop(route, 999)).toBeUndefined();
  });

  it('previousStop handles before-first and after-last', () => {
    expect(previousStop(route, -1)).toBeUndefined();
    expect(previousStop(route, 0)?.id).toBe('a');
    expect(previousStop(route, 199)?.id).toBe('b');
    expect(previousStop(route, 999)?.id).toBe('c');
  });

  it('stopsBetween is exclusive of the start and inclusive of the end', () => {
    expect(stopsBetween(route, 0, 200).map((s) => s.id)).toEqual(['b', 'c']);
    expect(stopsBetween(route, -1, 0).map((s) => s.id)).toEqual(['a']);
    expect(stopsBetween(route, 100, 150)).toEqual([]);
    expect(stopsBetween(route, 200, 999)).toEqual([]);
    expect(stopsBetween(route, 150, 50)).toEqual([]);
  });

  it('finds the home stop and route duration', () => {
    expect(homeStop(route).id).toBe('b');
    expect(routeDuration(route)).toBe(200);
  });
});
