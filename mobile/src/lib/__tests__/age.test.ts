import { MIN_AGE, isAtLeastAge, latestEligibleDob, toDateOnlyISO } from '../age';

describe('age gate helpers', () => {
  it('requires a minimum age of 18', () => {
    expect(MIN_AGE).toBe(18);
  });

  describe('toDateOnlyISO', () => {
    it('formats a local calendar date as YYYY-MM-DD with zero padding', () => {
      expect(toDateOnlyISO(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(toDateOnlyISO(new Date(2008, 11, 31))).toBe('2008-12-31');
    });
  });

  describe('latestEligibleDob', () => {
    it('returns the latest birth date that is exactly MIN_AGE years before today', () => {
      const today = new Date(2026, 5, 11); // 2026-06-11
      expect(toDateOnlyISO(latestEligibleDob(today))).toBe('2008-06-11');
    });

    it('round-trips through isAtLeastAge as eligible', () => {
      const today = new Date(2026, 5, 11);
      expect(isAtLeastAge(toDateOnlyISO(latestEligibleDob(today)), today)).toBe(true);
    });
  });

  describe('isAtLeastAge', () => {
    const today = new Date(2026, 5, 11); // 2026-06-11

    it('accepts someone turning 18 today', () => {
      expect(isAtLeastAge('2008-06-11', today)).toBe(true);
    });

    it('rejects someone turning 18 tomorrow', () => {
      expect(isAtLeastAge('2008-06-12', today)).toBe(false);
    });

    it('accepts a clearly adult date of birth', () => {
      expect(isAtLeastAge('1990-01-01', today)).toBe(true);
    });

    it('rejects a 17-year-old', () => {
      expect(isAtLeastAge('2009-06-11', today)).toBe(false);
    });

    it('treats a Feb 29 birthday as 18 only from Mar 1 in non-leap years', () => {
      expect(isAtLeastAge('2008-02-29', new Date(2026, 1, 28))).toBe(false); // 2026-02-28
      expect(isAtLeastAge('2008-02-29', new Date(2026, 2, 1))).toBe(true); // 2026-03-01
    });

    it('rejects a future date of birth', () => {
      expect(isAtLeastAge('2030-01-01', today)).toBe(false);
    });

    it('rejects malformed or impossible dates', () => {
      expect(isAtLeastAge('', today)).toBe(false);
      expect(isAtLeastAge('not-a-date', today)).toBe(false);
      expect(isAtLeastAge('2008-13-01', today)).toBe(false);
      expect(isAtLeastAge('2008-02-30', today)).toBe(false);
      expect(isAtLeastAge('2007-02-29', today)).toBe(false); // 2007 is not a leap year
    });
  });
});
