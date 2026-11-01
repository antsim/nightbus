import { z } from 'zod';

// Route data model. Offsets are seconds from the route's start, not clock
// times, so the same route can be driven at any hour and Digitransit
// `scheduledArrival` values convert by subtracting the departure time.

const StopSchema = z.object({
  /** Digitransit gtfsId (e.g. "HSL:1234567") or own id ("local:…"). */
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  offsetSec: z.number().nonnegative(),
  isHome: z.boolean().optional(),
  isTerminus: z.boolean().optional(),
  /** Popular stop (campus, hospital): other passengers ask to stop here more often. */
  busy: z.boolean().optional(),
});

const LandmarkSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Asset key, see assets/manifest.ts. */
  sprite: z.string().min(1),
  atOffsetSec: z.number().nonnegative(),
  side: z.enum(['left', 'right']),
  /** "The home stop comes after this" – for hint-based difficulty levels. */
  hintForStopId: z.string().min(1).optional(),
});

export const RouteSchema = z
  .object({
    id: z.string().min(1),
    lineName: z.string().min(1),
    headsign: z.string().min(1),
    stops: z.array(StopSchema).min(2),
    landmarks: z.array(LandmarkSchema),
  })
  .superRefine((route, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });
    const { stops, landmarks } = route;

    const ids = new Set<string>();
    stops.forEach((stop, i) => {
      if (ids.has(stop.id)) issue(`duplicate stop id "${stop.id}"`, ['stops', i, 'id']);
      ids.add(stop.id);
      const prev = stops[i - 1];
      if (prev && stop.offsetSec <= prev.offsetSec) {
        issue('offsetSec must be strictly increasing', ['stops', i, 'offsetSec']);
      }
      if (stop.isTerminus && i !== stops.length - 1) issue('only the last stop can be the terminus', ['stops', i]);
    });

    const homeCount = stops.filter((s) => s.isHome).length;
    if (homeCount !== 1) issue(`exactly one stop must have isHome, found ${homeCount}`, ['stops']);
    if (!stops[stops.length - 1]?.isTerminus) issue('the last stop must have isTerminus', ['stops']);
    if (stops[stops.length - 1]?.isHome) issue('the home stop cannot be the terminus', ['stops']);

    const end = stops[stops.length - 1]?.offsetSec ?? 0;
    const landmarkIds = new Set<string>();
    landmarks.forEach((lm, i) => {
      if (landmarkIds.has(lm.id)) issue(`duplicate landmark id "${lm.id}"`, ['landmarks', i, 'id']);
      landmarkIds.add(lm.id);
      if (lm.atOffsetSec > end) issue('atOffsetSec is past the terminus', ['landmarks', i, 'atOffsetSec']);
      if (lm.hintForStopId !== undefined && !ids.has(lm.hintForStopId)) {
        issue(`unknown stop "${lm.hintForStopId}"`, ['landmarks', i, 'hintForStopId']);
      }
    });
  });

export type Route = z.infer<typeof RouteSchema>;
export type Stop = Route['stops'][number];
export type Landmark = Route['landmarks'][number];

export class RouteValidationError extends Error {
  override readonly name = 'RouteValidationError';
}

/** Validates unknown JSON as a Route; throws a readable error listing every problem. */
export function parseRoute(data: unknown, source = 'route'): Route {
  const result = RouteSchema.safeParse(data);
  if (!result.success) {
    throw new RouteValidationError(`Invalid route "${source}":\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Stop within `toleranceSec` of `sec`, i.e. the bus is at that stop. */
export function stopAtOffset(route: Route, sec: number, toleranceSec = 0): Stop | undefined {
  return route.stops.find((s) => Math.abs(s.offsetSec - sec) <= toleranceSec);
}

/** First stop strictly after `sec`; undefined once past the terminus. */
export function nextStop(route: Route, sec: number): Stop | undefined {
  return route.stops.find((s) => s.offsetSec > sec);
}

/** Last stop at or before `sec`; undefined before the first stop. */
export function previousStop(route: Route, sec: number): Stop | undefined {
  return route.stops.findLast((s) => s.offsetSec <= sec);
}

/** Stops passed when moving from `fromSec` to `toSec`: fromSec < offset ≤ toSec. */
export function stopsBetween(route: Route, fromSec: number, toSec: number): Stop[] {
  return route.stops.filter((s) => s.offsetSec > fromSec && s.offsetSec <= toSec);
}

export function homeStop(route: Route): Stop {
  const home = route.stops.find((s) => s.isHome);
  if (!home) throw new RouteValidationError(`Route "${route.id}" has no home stop`);
  return home;
}

/** Route length in seconds (terminus offset). */
export function routeDuration(route: Route): number {
  return route.stops[route.stops.length - 1]?.offsetSec ?? 0;
}
