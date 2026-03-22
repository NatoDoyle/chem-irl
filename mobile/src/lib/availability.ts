import { localDateToUTC } from './timezone';
import { DAY_OF_WEEK_OPTIONS } from '../config/profileOptions';
import type { WeeklySlot, DayOfWeek } from './types';

/** Maps JS Date.getDay() (0=Sun) to our DayOfWeek values */
const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Maps our DayOfWeek values to JS Date.getDay() index */
const DAY_OF_WEEK_TO_JS_DAY: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function classifyPeriod(time: string): string {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function formatHHMM(time: string): string {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return minute === 0 ? `${displayHour} ${ampm}` : `${displayHour}:${minuteStr} ${ampm}`;
}

/**
 * Generates a human-readable summary from weekly slots for discovery cards.
 * e.g., "Sat afternoon, Wed & Fri evenings"
 */
export function generateAvailabilitySummary(slots: WeeklySlot[]): string {
  if (slots.length === 0) return '';

  // Group slots by period
  const byPeriod: Record<string, string[]> = {};
  for (const slot of slots) {
    const period = classifyPeriod(slot.start_time);
    const dayOption = DAY_OF_WEEK_OPTIONS.find((o) => o.value === slot.day);
    const shortDay = dayOption?.shortLabel ?? slot.day;
    if (!byPeriod[period]) byPeriod[period] = [];
    byPeriod[period].push(shortDay);
  }

  const parts: string[] = [];
  for (const [period, days] of Object.entries(byPeriod)) {
    const dayStr = days.join(' & ');
    const periodLabel = days.length > 1 ? `${period}s` : period;
    parts.push(`${dayStr} ${periodLabel}`);
  }

  return parts.join(', ');
}

/**
 * Converts a recurring weekly slot to a concrete proposal window.
 * Finds the next occurrence of the slot's day within 7 days,
 * then builds UTC ISO strings from the HH:MM local times.
 */
export function weeklySlotToProposalWindow(slot: WeeklySlot): { start: string; end: string } {
  const targetJsDay = DAY_OF_WEEK_TO_JS_DAY[slot.day];
  const now = new Date();
  const todayJsDay = now.getDay();

  // Find days until the next occurrence of targetJsDay
  let daysUntil = targetJsDay - todayJsDay;
  if (daysUntil < 0) daysUntil += 7;

  // If it's today, check if the start time has already passed
  if (daysUntil === 0) {
    const [startHour, startMinute] = slot.start_time.split(':').map(Number);
    const todayStart = new Date(now);
    todayStart.setHours(startHour, startMinute, 0, 0);
    if (todayStart <= now) {
      daysUntil = 7; // Use next week instead
    }
  }

  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntil);

  const [startHour, startMinute] = slot.start_time.split(':').map(Number);
  const [endHour, endMinute] = slot.end_time.split(':').map(Number);

  const startDate = new Date(targetDate);
  startDate.setHours(startHour, startMinute, 0, 0);

  const endDate = new Date(targetDate);
  endDate.setHours(endHour, endMinute, 0, 0);

  return {
    start: localDateToUTC(startDate),
    end: localDateToUTC(endDate),
  };
}

/**
 * Converts saved weekly slots to prefilled proposal windows.
 * Returns up to 3 concrete time windows for the next 7 days.
 */
export function weeklySlotsToPrefillWindows(slots: WeeklySlot[]): { start: string; end: string }[] {
  return slots.slice(0, 3).map(weeklySlotToProposalWindow);
}

/**
 * Formats a weekly slot for display in ProfileScreen.
 * e.g., "Saturday 2:00 PM - 4:00 PM"
 */
export function formatSlotDisplay(slot: WeeklySlot): string {
  const dayOption = DAY_OF_WEEK_OPTIONS.find((o) => o.value === slot.day);
  const dayLabel = dayOption?.label ?? slot.day;
  return `${dayLabel} ${formatHHMM(slot.start_time)} - ${formatHHMM(slot.end_time)}`;
}

/**
 * Validates a weekly slot. Returns an error message if invalid, null if valid.
 */
export function validateWeeklySlot(slot: WeeklySlot): string | null {
  if (!slot.day) return 'Please select a day';
  if (!slot.start_time || !slot.end_time) return 'Please select start and end times';

  if (!JS_DAY_TO_DAY_OF_WEEK.includes(slot.day)) return 'Invalid day selected';

  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(slot.start_time) || !timeRegex.test(slot.end_time)) {
    return 'Invalid time format';
  }

  if (slot.start_time >= slot.end_time) {
    return 'End time must be after start time';
  }

  return null;
}
