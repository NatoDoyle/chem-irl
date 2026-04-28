// Shared email validation primitives used by both the rich Dublin
// waitlist signup function and the lightweight blog-subscribe function.
// Refresh the disposable-domain list quarterly per
// docs/DUBLIN_LAUNCH_PLAN.md §2.6.

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  '0clickemail.com',
  '10minutemail.com',
  '20minutemail.com',
  'discard.email',
  'discardmail.com',
  'dispostable.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'inboxbear.com',
  'maildrop.cc',
  'mailinator.com',
  'mintemail.com',
  'mohmal.com',
  'mt2014.com',
  'mt2015.com',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'tempail.com',
  'tempmail.com',
  'temp-mail.org',
  'temporary-mail.net',
  'throwaway.email',
  'trashmail.com',
  'yopmail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
