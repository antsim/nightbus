const MINUTES_PER_DAY = 24 * 60;
// Game time is accumulated from float steps (e.g. 0.6 min), so 190 can arrive
// as 189.99999…; tolerate that when flooring to whole minutes.
const FLOOR_EPSILON = 1e-6;

export interface ClockState {
  /** Game time in minutes since the midnight before the run started. Can exceed 24 h. */
  minutes: number;
  /** Game minutes per real second. */
  timeScale: number;
}

/** Parses "HH:MM" into minutes since midnight. */
export function parseTime(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}", expected HH:MM`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time "${hhmm}"`);
  return hours * 60 + minutes;
}

/** Formats game minutes as "HH:MM", wrapping past midnight. */
export function formatTime(minutes: number): string {
  const wrapped = ((Math.floor(minutes + FLOOR_EPSILON) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function createClock(startTime: string, timeScale: number): ClockState {
  return { minutes: parseTime(startTime), timeScale };
}

/** Game minutes that pass during `realMs` real milliseconds. */
export function gameMinutesFor(clock: ClockState, realMs: number): number {
  return (realMs / 1000) * clock.timeScale;
}

export function advanceClock(clock: ClockState, realMs: number): ClockState {
  return { ...clock, minutes: clock.minutes + gameMinutesFor(clock, realMs) };
}
