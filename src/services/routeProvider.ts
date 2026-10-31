import { parseRoute, type Route } from '../core/route';

export interface RouteProvider {
  getRoute(routeId: string): Promise<Route>;
}

type RouteLoader = () => Promise<unknown>;

// Each route JSON becomes its own lazily loaded chunk.
const BUNDLED_ROUTES = import.meta.glob('../data/routes/*.json', { import: 'default' });

/** "../data/routes/home-night-bus.json" → "home-night-bus" */
function routeIdFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.json$/, '');
}

/** Reads hand-made routes from src/data/routes/<routeId>.json. */
export class StaticRouteProvider implements RouteProvider {
  private readonly loaders = new Map<string, RouteLoader>();

  constructor(loadersByPath: Record<string, RouteLoader> = BUNDLED_ROUTES) {
    for (const [path, load] of Object.entries(loadersByPath)) this.loaders.set(routeIdFromPath(path), load);
  }

  routeIds(): string[] {
    return [...this.loaders.keys()].sort();
  }

  async getRoute(routeId: string): Promise<Route> {
    const load = this.loaders.get(routeId);
    if (!load) throw new Error(`Unknown route "${routeId}". Available: ${this.routeIds().join(', ')}`);
    const route = parseRoute(await load(), `${routeId}.json`);
    if (route.id !== routeId) throw new Error(`Route file ${routeId}.json has mismatching id "${route.id}"`);
    return route;
  }
}
