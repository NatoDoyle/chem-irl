import { isValidTimeWindow, isWithinSevenDays, localDateToUTC } from './timezone';

export type TimeWindow = { start: string; end: string };

export type WindowValidationResult = { ok: true } | { ok: false; message: string };

/**
 * Builds a UTC time window from a local start `Date` and a duration.
 * Used by the length chips (1h/2h/3h/4h) in the proposal time picker.
 */
export function windowFromStartAndDuration(
  start: Date,
  durationMinutes: number
): { startUTC: string; endUTC: string } {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    startUTC: localDateToUTC(start),
    endUTC: localDateToUTC(end),
  };
}

/**
 * Returns the duration of a window in minutes. Negative if end < start.
 */
export function durationMinutesOf(startISO: string, endISO: string): number {
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();
  return Math.round((endMs - startMs) / 60_000);
}

/**
 * Checks whether `candidate` overlaps any window in `existing`.
 * `excludeIndex` skips that index — use it when validating an edit so the
 * window being edited doesn't overlap with itself.
 */
export function hasWindowOverlap(
  existing: TimeWindow[],
  candidate: TimeWindow,
  excludeIndex?: number
): boolean {
  return existing.some((window, index) => {
    if (index === excludeIndex) return false;
    const wStart = new Date(window.start);
    const wEnd = new Date(window.end);
    const cStart = new Date(candidate.start);
    const cEnd = new Date(candidate.end);
    return (
      (cStart >= wStart && cStart < wEnd) ||
      (cEnd > wStart && cEnd <= wEnd) ||
      (cStart <= wStart && cEnd >= wEnd)
    );
  });
}

/**
 * Validates a candidate window against the existing list. Returns user-facing
 * messages that match the strings used in `ProposeScreen` before this refactor
 * so behavior is preserved for the user.
 */
export function validateWindow(
  startUTC: string,
  endUTC: string,
  existing: TimeWindow[],
  excludeIndex?: number
): WindowValidationResult {
  if (!isValidTimeWindow(startUTC, endUTC)) {
    return { ok: false, message: 'End time must be after start time' };
  }
  if (!isWithinSevenDays(startUTC)) {
    return { ok: false, message: 'All time windows must be within the next 7 days' };
  }
  if (hasWindowOverlap(existing, { start: startUTC, end: endUTC }, excludeIndex)) {
    return { ok: false, message: 'Time windows cannot overlap' };
  }
  return { ok: true };
}
