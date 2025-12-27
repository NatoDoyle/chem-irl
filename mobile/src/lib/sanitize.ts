/**
 * Input sanitization utilities for user-generated content
 *
 * Sanitizes text inputs to prevent XSS and injection attacks.
 * While RLS protects the database, this provides defense-in-depth
 * for future web views or if content is rendered unsafely.
 */

/**
 * Sanitize text input by removing/escaping potentially dangerous characters
 *
 * @param input - User input string
 * @returns Sanitized string safe for storage and display
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Escape special characters that could be used for injection
  // This is a basic sanitization - for production, consider using a library like DOMPurify
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Trim whitespace
  return sanitized.trim();
}

/**
 * Sanitize text but preserve line breaks (for multi-line inputs like bio, notes)
 *
 * @param input - User input string
 * @returns Sanitized string with line breaks preserved
 */
export function sanitizeMultilineText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // First, normalize line breaks
  let sanitized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Escape special characters but preserve newlines
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Trim whitespace but preserve internal line breaks
  return sanitized.trim();
}
