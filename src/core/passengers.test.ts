import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { stopPlan } from './passengers';
import { defaultRoute as route } from './testing/bots';

const ST = BALANCE.stops;
const indices = route.stops.map((_, i) => i);

describe('stopPlan', () => {
  it('is the same every time it is asked', () => {
    for (const i of indices) expect(stopPlan(7, route, i)).toEqual(stopPlan(7, route, i));
  });

  it('nobody at the first stop or the terminus', () => {
    const none = { waiting: false, otherRequest: false, otherAtOffsetSec: null };
    expect(stopPlan(7, route, 0)).toEqual(none);
    expect(stopPlan(7, route, route.stops.length - 1)).toEqual(none);
  });

  it("another passenger's request lights up between the stops, early enough to react", () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const i of indices.slice(1, -1)) {
        const p = stopPlan(seed, route, i);
        if (p.otherAtOffsetSec === null) continue;
        const prev = route.stops[i - 1]!.offsetSec;
        const stop = route.stops[i]!.offsetSec;
        expect(p.otherAtOffsetSec).toBeGreaterThanOrEqual(prev);
        expect(p.otherAtOffsetSec).toBeLessThanOrEqual(Math.max(prev, stop - ST.requestCutoffSec - ST.minLeadSec));
      }
    }
  });

  it('roughly matches the chances, with busy stops more popular', () => {
    const share = (pick: (i: number) => boolean, busy: boolean) => {
      let hits = 0;
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        for (const i of indices.slice(1, -1)) {
          if (Boolean(route.stops[i]!.busy) !== busy) continue;
          n++;
          if (pick(i + seed * 1000)) hits++;
        }
      }
      return hits / n;
    };
    const plan = (key: number) => stopPlan(Math.floor(key / 1000), route, key % 1000);
    expect(share((k) => plan(k).waiting, false)).toBeCloseTo(ST.waitingChance, 1);
    expect(share((k) => plan(k).otherRequest, false)).toBeCloseTo(ST.otherRequestChance, 1);
    expect(share((k) => plan(k).otherRequest, true)).toBeCloseTo(ST.busyOtherRequestChance, 1);
  });
});
