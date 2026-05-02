import {
  durationMinutesOf,
  hasWindowOverlap,
  validateWindow,
  windowFromStartAndDuration,
} from '../timeWindow';

function isoIn(days: number, hours: number, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

describe('windowFromStartAndDuration', () => {
  it('returns the start ISO and an end shifted by the chip duration', () => {
    const start = new Date('2026-05-10T19:00:00.000Z');
    const { startUTC, endUTC } = windowFromStartAndDuration(start, 120);
    expect(startUTC).toBe('2026-05-10T19:00:00.000Z');
    expect(endUTC).toBe('2026-05-10T21:00:00.000Z');
  });

  it.each([60, 120, 180, 240])('handles a %i-minute chip', (minutes) => {
    const start = new Date('2026-05-10T19:00:00.000Z');
    const { startUTC, endUTC } = windowFromStartAndDuration(start, minutes);
    expect(durationMinutesOf(startUTC, endUTC)).toBe(minutes);
  });
});

describe('durationMinutesOf', () => {
  it('returns positive minutes for a forward window', () => {
    expect(durationMinutesOf('2026-05-10T19:00:00.000Z', '2026-05-10T21:30:00.000Z')).toBe(150);
  });

  it('returns a negative number when end precedes start', () => {
    expect(durationMinutesOf('2026-05-10T21:00:00.000Z', '2026-05-10T19:00:00.000Z')).toBe(-120);
  });
});

describe('hasWindowOverlap', () => {
  const existing = [
    { start: '2026-05-10T19:00:00.000Z', end: '2026-05-10T21:00:00.000Z' },
    { start: '2026-05-12T18:00:00.000Z', end: '2026-05-12T20:00:00.000Z' },
  ];

  it('returns false when there is no overlap', () => {
    expect(
      hasWindowOverlap(existing, {
        start: '2026-05-11T19:00:00.000Z',
        end: '2026-05-11T21:00:00.000Z',
      })
    ).toBe(false);
  });

  it('detects an exact match overlap', () => {
    expect(
      hasWindowOverlap(existing, {
        start: '2026-05-10T19:00:00.000Z',
        end: '2026-05-10T21:00:00.000Z',
      })
    ).toBe(true);
  });

  it('detects a candidate that starts inside an existing window', () => {
    expect(
      hasWindowOverlap(existing, {
        start: '2026-05-10T20:00:00.000Z',
        end: '2026-05-10T22:00:00.000Z',
      })
    ).toBe(true);
  });

  it('detects a candidate that ends inside an existing window', () => {
    expect(
      hasWindowOverlap(existing, {
        start: '2026-05-10T18:00:00.000Z',
        end: '2026-05-10T20:00:00.000Z',
      })
    ).toBe(true);
  });

  it('detects a candidate that fully contains an existing window', () => {
    expect(
      hasWindowOverlap(existing, {
        start: '2026-05-10T18:00:00.000Z',
        end: '2026-05-10T22:00:00.000Z',
      })
    ).toBe(true);
  });

  it('returns false when the only overlapping window is excluded by index', () => {
    expect(
      hasWindowOverlap(
        existing,
        { start: '2026-05-10T19:00:00.000Z', end: '2026-05-10T21:00:00.000Z' },
        0
      )
    ).toBe(false);
  });

  it('still detects overlap with windows other than the excluded one', () => {
    expect(
      hasWindowOverlap(
        existing,
        { start: '2026-05-12T19:00:00.000Z', end: '2026-05-12T21:00:00.000Z' },
        0
      )
    ).toBe(true);
  });
});

describe('validateWindow', () => {
  it('accepts a valid window in the next 7 days with no overlap', () => {
    const start = isoIn(2, 19);
    const end = isoIn(2, 21);
    expect(validateWindow(start, end, [])).toEqual({ ok: true });
  });

  it('rejects when end is before start', () => {
    const start = isoIn(2, 21);
    const end = isoIn(2, 19);
    expect(validateWindow(start, end, [])).toEqual({
      ok: false,
      message: 'End time must be after start time',
    });
  });

  it('rejects when start is more than 7 days out', () => {
    const start = isoIn(8, 19);
    const end = isoIn(8, 21);
    expect(validateWindow(start, end, [])).toEqual({
      ok: false,
      message: 'All time windows must be within the next 7 days',
    });
  });

  it('rejects when start is in the past', () => {
    const start = isoIn(-1, 19);
    const end = isoIn(-1, 21);
    expect(validateWindow(start, end, [])).toEqual({
      ok: false,
      message: 'All time windows must be within the next 7 days',
    });
  });

  it('rejects when the candidate overlaps an existing window', () => {
    const existingStart = isoIn(2, 19);
    const existingEnd = isoIn(2, 21);
    const start = isoIn(2, 20);
    const end = isoIn(2, 22);
    expect(validateWindow(start, end, [{ start: existingStart, end: existingEnd }])).toEqual({
      ok: false,
      message: 'Time windows cannot overlap',
    });
  });

  it('accepts an unchanged edit when excludeIndex skips the only overlapper', () => {
    const start = isoIn(2, 19);
    const end = isoIn(2, 21);
    expect(validateWindow(start, end, [{ start, end }], 0)).toEqual({ ok: true });
  });
});
