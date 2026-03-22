import {
  generateAvailabilitySummary,
  weeklySlotToProposalWindow,
  weeklySlotsToPrefillWindows,
  formatSlotDisplay,
  validateWeeklySlot,
} from '../availability';
import type { WeeklySlot } from '../types';

describe('generateAvailabilitySummary', () => {
  it('returns empty string for no slots', () => {
    expect(generateAvailabilitySummary([])).toBe('');
  });

  it('returns single slot summary', () => {
    const slots: WeeklySlot[] = [{ day: 'saturday', start_time: '14:00', end_time: '16:00' }];
    expect(generateAvailabilitySummary(slots)).toBe('Sat afternoon');
  });

  it('groups same-period slots', () => {
    const slots: WeeklySlot[] = [
      { day: 'saturday', start_time: '14:00', end_time: '16:00' },
      { day: 'sunday', start_time: '13:00', end_time: '15:00' },
    ];
    expect(generateAvailabilitySummary(slots)).toBe('Sat & Sun afternoons');
  });

  it('separates different periods', () => {
    const slots: WeeklySlot[] = [
      { day: 'wednesday', start_time: '19:00', end_time: '21:00' },
      { day: 'saturday', start_time: '14:00', end_time: '16:00' },
    ];
    expect(generateAvailabilitySummary(slots)).toBe('Wed evening, Sat afternoon');
  });

  it('classifies morning correctly', () => {
    const slots: WeeklySlot[] = [{ day: 'sunday', start_time: '09:00', end_time: '11:00' }];
    expect(generateAvailabilitySummary(slots)).toBe('Sun morning');
  });

  it('classifies night correctly', () => {
    const slots: WeeklySlot[] = [{ day: 'friday', start_time: '21:00', end_time: '23:00' }];
    expect(generateAvailabilitySummary(slots)).toBe('Fri night');
  });
});

describe('weeklySlotToProposalWindow', () => {
  it('returns a window with valid UTC ISO strings', () => {
    const slot: WeeklySlot = { day: 'saturday', start_time: '14:00', end_time: '16:00' };
    const window = weeklySlotToProposalWindow(slot);

    expect(window.start).toBeTruthy();
    expect(window.end).toBeTruthy();
    // Should be valid ISO strings
    expect(new Date(window.start).toISOString()).toBe(window.start);
    expect(new Date(window.end).toISOString()).toBe(window.end);
  });

  it('returns a window where start is before end', () => {
    const slot: WeeklySlot = { day: 'wednesday', start_time: '18:00', end_time: '20:00' };
    const window = weeklySlotToProposalWindow(slot);
    expect(new Date(window.start).getTime()).toBeLessThan(new Date(window.end).getTime());
  });

  it('returns a window within 7 days from now', () => {
    const slot: WeeklySlot = { day: 'friday', start_time: '19:00', end_time: '21:00' };
    const window = weeklySlotToProposalWindow(slot);

    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 8); // +8 for buffer

    const startDate = new Date(window.start);
    expect(startDate.getTime()).toBeGreaterThan(now.getTime() - 86400000); // within reason
    expect(startDate.getTime()).toBeLessThan(sevenDaysFromNow.getTime());
  });

  it('produces the correct day of week', () => {
    const slot: WeeklySlot = { day: 'monday', start_time: '10:00', end_time: '12:00' };
    const window = weeklySlotToProposalWindow(slot);
    const startDate = new Date(window.start);
    // getDay() === 1 is Monday
    expect(startDate.getDay()).toBe(1);
  });
});

describe('weeklySlotsToPrefillWindows', () => {
  it('returns empty array for empty input', () => {
    expect(weeklySlotsToPrefillWindows([])).toEqual([]);
  });

  it('returns windows for each slot', () => {
    const slots: WeeklySlot[] = [
      { day: 'monday', start_time: '18:00', end_time: '20:00' },
      { day: 'wednesday', start_time: '19:00', end_time: '21:00' },
    ];
    const windows = weeklySlotsToPrefillWindows(slots);
    expect(windows).toHaveLength(2);
    expect(windows[0].start).toBeTruthy();
    expect(windows[1].start).toBeTruthy();
  });

  it('limits to 3 windows', () => {
    const slots: WeeklySlot[] = [
      { day: 'monday', start_time: '18:00', end_time: '20:00' },
      { day: 'tuesday', start_time: '18:00', end_time: '20:00' },
      { day: 'wednesday', start_time: '18:00', end_time: '20:00' },
    ];
    const windows = weeklySlotsToPrefillWindows(slots);
    expect(windows.length).toBeLessThanOrEqual(3);
  });
});

describe('formatSlotDisplay', () => {
  it('formats a slot with day and times', () => {
    const slot: WeeklySlot = { day: 'saturday', start_time: '14:00', end_time: '16:00' };
    expect(formatSlotDisplay(slot)).toBe('Saturday 2 PM - 4 PM');
  });

  it('formats times with minutes', () => {
    const slot: WeeklySlot = { day: 'wednesday', start_time: '18:30', end_time: '20:15' };
    expect(formatSlotDisplay(slot)).toBe('Wednesday 6:30 PM - 8:15 PM');
  });

  it('formats morning times correctly', () => {
    const slot: WeeklySlot = { day: 'sunday', start_time: '09:00', end_time: '11:00' };
    expect(formatSlotDisplay(slot)).toBe('Sunday 9 AM - 11 AM');
  });

  it('formats noon correctly', () => {
    const slot: WeeklySlot = { day: 'monday', start_time: '12:00', end_time: '14:00' };
    expect(formatSlotDisplay(slot)).toBe('Monday 12 PM - 2 PM');
  });
});

describe('validateWeeklySlot', () => {
  it('returns null for a valid slot', () => {
    const slot: WeeklySlot = { day: 'saturday', start_time: '14:00', end_time: '16:00' };
    expect(validateWeeklySlot(slot)).toBeNull();
  });

  it('returns error when start >= end', () => {
    const slot: WeeklySlot = { day: 'saturday', start_time: '16:00', end_time: '14:00' };
    expect(validateWeeklySlot(slot)).toBe('End time must be after start time');
  });

  it('returns error when start equals end', () => {
    const slot: WeeklySlot = { day: 'saturday', start_time: '14:00', end_time: '14:00' };
    expect(validateWeeklySlot(slot)).toBe('End time must be after start time');
  });

  it('returns error for missing day', () => {
    const slot = { day: '', start_time: '14:00', end_time: '16:00' } as unknown as WeeklySlot;
    expect(validateWeeklySlot(slot)).toBeTruthy();
  });

  it('returns error for missing times', () => {
    const slot = { day: 'saturday', start_time: '', end_time: '16:00' } as unknown as WeeklySlot;
    expect(validateWeeklySlot(slot)).toBeTruthy();
  });

  it('returns error for invalid time format', () => {
    const slot: WeeklySlot = { day: 'saturday', start_time: '2pm', end_time: '4pm' };
    expect(validateWeeklySlot(slot)).toBe('Invalid time format');
  });
});
