import { describe, expect, it } from 'vitest';
import { homeStop, parseRoute, routeDuration } from '../core/route';
import { StaticRouteProvider } from './routeProvider';

// Every bundled route must validate – a broken route can't reach main.
const routeFiles = import.meta.glob('../data/routes/*.json', { eager: true, import: 'default' });

describe('bundled routes', () => {
  it('exist', () => {
    expect(Object.keys(routeFiles).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(routeFiles))('%s is valid', (path, data) => {
    const route = parseRoute(data, path);
    expect(route.stops.filter((s) => s.isHome)).toHaveLength(1);
    expect(route.stops.at(-1)?.isTerminus).toBe(true);
  });
});

describe('StaticRouteProvider', () => {
  const provider = new StaticRouteProvider();

  it('loads the example route', async () => {
    const route = await provider.getRoute('home-night-bus');
    expect(route.id).toBe('home-night-bus');
    expect(route.stops.length).toBeGreaterThanOrEqual(12);
    expect(route.stops.length).toBeLessThanOrEqual(18);
    expect(route.landmarks.length).toBeGreaterThanOrEqual(4);
    expect(route.landmarks.length).toBeLessThanOrEqual(6);

    // Home stop roughly two thirds into the route.
    const homeShare = homeStop(route).offsetSec / routeDuration(route);
    expect(homeShare).toBeGreaterThan(0.55);
    expect(homeShare).toBeLessThan(0.8);
  });

  it('rejects unknown route ids', async () => {
    await expect(provider.getRoute('nope')).rejects.toThrow(/Unknown route "nope"/);
  });

  it('rejects a file whose id does not match its name', async () => {
    const data = await provider.getRoute('home-night-bus');
    const mismatched = new StaticRouteProvider({ './other.json': async () => data });
    await expect(mismatched.getRoute('other')).rejects.toThrow(/mismatching id/);
  });

  it('reports invalid JSON with the file name', async () => {
    const broken = new StaticRouteProvider({ './broken.json': async () => ({ id: 'broken' }) });
    await expect(broken.getRoute('broken')).rejects.toThrow(/Invalid route "broken\.json"/);
  });
});
