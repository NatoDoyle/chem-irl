// Age-gate helpers (T1.3). Chem IRL is 18+ only: the AgeDob onboarding
// screen collects a date of birth, validates it client-side with
// isAtLeastAge, and the users_dob_18_plus CHECK constraint enforces the
// same boundary server-side.
//
// Dates of birth are calendar dates, not instants — all math here works
// on local Y/M/D parts to avoid UTC off-by-one-day bugs near midnight.

export const MIN_AGE = 18;

/** Formats a Date as a local-calendar 'YYYY-MM-DD' string (Postgres `date`). */
export function toDateOnlyISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * The most recent birth date that still makes someone MIN_AGE today —
 * use as the date picker's maximumDate.
 */
export function latestEligibleDob(today: Date = new Date()): Date {
  return new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
}

/**
 * Whether a 'YYYY-MM-DD' date of birth is at least MIN_AGE years before
 * `today`. Fails closed: malformed or impossible dates return false.
 */
export function isAtLeastAge(dobISO: string, today: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobISO);
  if (!match) return false;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  // Reject impossible dates (2008-13-01, 2008-02-30, Feb 29 off-leap-year):
  // the Date constructor rolls them over instead of erroring.
  const dob = new Date(y, m - 1, d);
  if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) {
    return false;
  }

  return dob.getTime() <= latestEligibleDob(today).getTime();
}
