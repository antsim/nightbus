import { z } from 'zod';
import type { RunReport } from '../core/report';

const STORAGE_KEY = 'yobussi.v1.best';

const BestScoreSchema = z.object({
  score: z.number(),
  outcome: z.enum(['home', 'tooEarly', 'overshot', 'terminus']),
  seed: z.number(),
  routeId: z.string(),
  /** ISO date string. */
  date: z.string(),
});

export type BestScore = z.infer<typeof BestScoreSchema>;

/** Minimal storage interface so tests can pass an in-memory fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Best result so far, or null if none (or storage is unavailable / corrupted). */
export function loadBest(storage: KeyValueStorage | null = defaultStorage()): BestScore | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = BestScoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Saves the report if it beats the stored best. Returns true for a new record. */
export function saveIfBest(report: RunReport, now: Date, storage: KeyValueStorage | null = defaultStorage()): boolean {
  // A zero score is never a record, not even the first one.
  if (report.score <= 0) return false;
  const best = loadBest(storage);
  if (best && best.score >= report.score) return false;
  const entry: BestScore = {
    score: report.score,
    outcome: report.outcome.kind,
    seed: report.seed,
    routeId: report.routeId,
    date: now.toISOString(),
  };
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Private mode or full storage: the record just isn't remembered.
  }
  return true;
}
