/**
 * Timezone utilities for proposal date/time handling
 *
 * All proposal times are stored in UTC in the database.
 * These utilities help convert between UTC and the user's local timezone
 * for display purposes.
 */

/**
 * Converts a local Date to UTC ISO string for storage
 * This ensures times are stored consistently regardless of user's timezone
 */
export function localDateToUTC(date: Date): string {
  return date.toISOString();
}

/**
 * Converts a UTC ISO string to a local Date object
 * The Date object will represent the same moment in time but in local timezone
 */
export function utcStringToLocalDate(utcString: string): Date {
  return new Date(utcString);
}

/**
 * Formats a UTC ISO string for display in the user's local timezone
 * Returns a formatted string with date and time
 */
export function formatProposalTime(utcString: string): string {
  const localDate = utcStringToLocalDate(utcString);
  return localDate.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Formats a UTC ISO string as a date-only string (no time)
 */
export function formatProposalDate(utcString: string): string {
  const localDate = utcStringToLocalDate(utcString);
  return localDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a UTC ISO string as a time-only string (no date)
 */
export function formatProposalTimeOnly(utcString: string): string {
  const localDate = utcStringToLocalDate(utcString);
  return localDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Gets the user's timezone identifier (e.g., "America/New_York")
 * Falls back to a formatted offset if timezone is not available
 */
export function getUserTimezone(): string {
  try {
    // Try to get IANA timezone identifier
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      return timezone;
    }
  } catch {
    // Fallback if timezone detection fails
  }

  // Fallback to offset-based timezone
  const offset = -new Date().getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  return `UTC${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Validates that a date/time window is within 7 days from now
 * Compares UTC times to ensure consistent validation across timezones
 */
export function isWithinSevenDays(utcString: string): boolean {
  const windowDate = utcStringToLocalDate(utcString);
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  return windowDate >= now && windowDate <= sevenDaysFromNow;
}

/**
 * Validates that start time is before end time
 * Works with UTC ISO strings
 */
export function isValidTimeWindow(start: string, end: string): boolean {
  const startDate = utcStringToLocalDate(start);
  const endDate = utcStringToLocalDate(end);
  return startDate < endDate;
}
