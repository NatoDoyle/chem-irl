import { isRlsError, isMissingRow } from '../errors';

describe('errors', () => {
  describe('isRlsError', () => {
    it('should return true for error code "42501"', () => {
      expect(isRlsError({ code: '42501' })).toBe(true);
    });

    it('should return true for numeric error code 42501 (normalized to string)', () => {
      expect(isRlsError({ code: 42501 })).toBe(true);
    });

    it('should return true for error code "PGRST301"', () => {
      expect(isRlsError({ code: 'PGRST301' })).toBe(true);
    });

    it('should return true for status 403 with empty message (status fallback)', () => {
      expect(isRlsError({ status: 403, message: '' })).toBe(true);
    });

    it('should return true for status 401', () => {
      expect(isRlsError({ status: 401, message: '' })).toBe(true);
    });

    it('should return true for message containing "new row violates row-level security policy"', () => {
      expect(isRlsError({ message: 'new row violates row-level security policy' })).toBe(true);
    });

    it('should return true for message containing "permission denied"', () => {
      expect(isRlsError({ message: 'permission denied' })).toBe(true);
    });

    it('should return true for message containing "row-level security"', () => {
      expect(isRlsError({ message: 'row-level security' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isRlsError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRlsError(undefined)).toBe(false);
    });

    it('should return false for non-RLS error', () => {
      expect(isRlsError({ code: 'PGRST116', message: 'not found' })).toBe(false);
    });

    it('should return false for status 404 (not 401/403)', () => {
      expect(isRlsError({ status: 404, message: '' })).toBe(false);
    });

    it('should return true for string status "403"', () => {
      expect(isRlsError({ status: '403', message: '' })).toBe(true);
    });

    it('should return true for string status "401"', () => {
      expect(isRlsError({ status: '401', message: '' })).toBe(true);
    });

    it('should return false for non-numeric string status', () => {
      expect(isRlsError({ status: 'not-a-number', message: '' })).toBe(false);
    });
  });

  describe('isMissingRow', () => {
    it('should return true for null data and null error', () => {
      expect(isMissingRow(null, null)).toBe(true);
    });

    it('should return true for undefined data and null error', () => {
      expect(isMissingRow(undefined, null)).toBe(true);
    });

    it('should return true for null data and undefined error', () => {
      expect(isMissingRow(null, undefined)).toBe(true);
    });

    it('should return false for object data and null error', () => {
      expect(isMissingRow({}, null)).toBe(false);
    });

    it('should return false for null data and error object', () => {
      expect(isMissingRow(null, { code: 'anything' })).toBe(false);
    });

    it('should return false for object data and error object', () => {
      expect(isMissingRow({ id: '123' }, { code: 'PGRST116' })).toBe(false);
    });

    it('should return false for empty array data and null error', () => {
      expect(isMissingRow([], null)).toBe(false);
    });
  });
});
