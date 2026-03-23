import { formatCountdown } from '../countdown';

const BASE = new Date('2026-03-22T12:00:00Z');

function expiresIn(ms: number): string {
  return new Date(BASE.getTime() + ms).toISOString();
}

const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

describe('formatCountdown', () => {
  describe('expired', () => {
    it('returns Expired when time has passed', () => {
      const result = formatCountdown(expiresIn(-1000), BASE);
      expect(result.isExpired).toBe(true);
      expect(result.text).toBe('Expired');
      expect(result.urgency).toBe('expired');
      expect(result.msRemaining).toBe(0);
    });

    it('returns Expired at exactly zero', () => {
      const result = formatCountdown(expiresIn(0), BASE);
      expect(result.isExpired).toBe(true);
      expect(result.text).toBe('Expired');
    });
  });

  describe('urgent (<12h)', () => {
    it('shows minutes when <1h', () => {
      const result = formatCountdown(expiresIn(45 * MS_MINUTE), BASE);
      expect(result.urgency).toBe('urgent');
      expect(result.text).toBe('45m');
      expect(result.isExpired).toBe(false);
    });

    it('shows at least 1m for very small remaining time', () => {
      const result = formatCountdown(expiresIn(5000), BASE);
      expect(result.text).toBe('1m');
      expect(result.urgency).toBe('urgent');
    });

    it('shows hours and minutes at 11h 30m', () => {
      const result = formatCountdown(expiresIn(11.5 * MS_HOUR), BASE);
      expect(result.urgency).toBe('urgent');
      expect(result.text).toBe('11h 30m');
    });
  });

  describe('warning (12-24h)', () => {
    it('is warning at exactly 12h + 1ms', () => {
      const result = formatCountdown(expiresIn(12 * MS_HOUR + 1), BASE);
      expect(result.urgency).toBe('warning');
    });

    it('shows hours and minutes at 23h 45m', () => {
      const result = formatCountdown(expiresIn(23 * MS_HOUR + 45 * MS_MINUTE), BASE);
      expect(result.urgency).toBe('warning');
      expect(result.text).toBe('23h 45m');
    });

    it('is urgent at exactly 12h', () => {
      const result = formatCountdown(expiresIn(12 * MS_HOUR), BASE);
      expect(result.urgency).toBe('urgent');
    });
  });

  describe('normal (>24h)', () => {
    it('is normal at 24h + 1ms', () => {
      const result = formatCountdown(expiresIn(24 * MS_HOUR + 1), BASE);
      expect(result.urgency).toBe('normal');
    });

    it('shows days and hours at 2d 14h', () => {
      const result = formatCountdown(expiresIn(2 * MS_DAY + 14 * MS_HOUR), BASE);
      expect(result.urgency).toBe('normal');
      expect(result.text).toBe('2d 14h');
    });

    it('is warning at exactly 24h', () => {
      const result = formatCountdown(expiresIn(24 * MS_HOUR), BASE);
      expect(result.urgency).toBe('warning');
    });
  });

  describe('msRemaining', () => {
    it('returns accurate milliseconds', () => {
      const ms = 5 * MS_HOUR + 30 * MS_MINUTE;
      const result = formatCountdown(expiresIn(ms), BASE);
      expect(result.msRemaining).toBe(ms);
    });
  });
});
