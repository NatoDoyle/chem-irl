/**
 * Validates phone number in E.164 format
 * E.164 format: +[country code][subscriber number]
 * - Must start with +
 * - Total length (including +) should be 8-16 characters
 * - Only digits after the +
 * - Country code is 1-3 digits
 */
export function isValidE164Phone(phone: string): boolean {
  const trimmed = phone.trim();

  // Must start with +
  if (!trimmed.startsWith('+')) {
    return false;
  }

  // Must have at least country code + subscriber number (minimum 8 chars: +1234567)
  // Maximum 16 chars: +123456789012345
  if (trimmed.length < 8 || trimmed.length > 16) {
    return false;
  }

  // Only digits after the +
  const digitsOnly = trimmed.slice(1);
  if (!/^\d+$/.test(digitsOnly)) {
    return false;
  }

  // Country code should be 1-3 digits, subscriber number at least 4 digits
  // This is a basic check - actual country codes vary
  if (digitsOnly.length < 5) {
    return false;
  }

  return true;
}

/**
 * Formats phone number input to E.164 format
 * - Removes all non-digit characters
 * - Adds + prefix
 * - Limits to 15 digits (max E.164 length excluding +)
 */
export function formatToE164(input: string): string {
  // Remove all non-digits
  const digits = input.replace(/\D/g, '');

  if (digits.length === 0) {
    return '';
  }

  // Limit to 15 digits (max E.164 length excluding +)
  const limitedDigits = digits.slice(0, 15);

  return `+${limitedDigits}`;
}

