const Urgency = {
  Normal: 'normal',
  Warning: 'warning',
  Urgent: 'urgent',
  Expired: 'expired',
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
type Urgency = (typeof Urgency)[keyof typeof Urgency];

interface CountdownResult {
  text: string;
  urgency: Urgency;
  isExpired: boolean;
  msRemaining: number;
}

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const HOURS_24 = 24 * MS_PER_HOUR;
const HOURS_12 = 12 * MS_PER_HOUR;

/**
 * Compute countdown text and urgency from an expiration timestamp.
 *
 * @param expiresAt  ISO 8601 timestamp string
 * @param now        Optional override for current time (for testing)
 */
export function formatCountdown(expiresAt: string, now?: Date): CountdownResult {
  const expiresMs = new Date(expiresAt).getTime();
  const nowMs = (now ?? new Date()).getTime();
  const msRemaining = expiresMs - nowMs;

  if (msRemaining <= 0) {
    return { text: 'Expired', urgency: Urgency.Expired, isExpired: true, msRemaining: 0 };
  }

  let urgency: Urgency;
  if (msRemaining > HOURS_24) {
    urgency = Urgency.Normal;
  } else if (msRemaining > HOURS_12) {
    urgency = Urgency.Warning;
  } else {
    urgency = Urgency.Urgent;
  }

  let text: string;
  if (msRemaining >= MS_PER_DAY) {
    const days = Math.floor(msRemaining / MS_PER_DAY);
    const hours = Math.floor((msRemaining % MS_PER_DAY) / MS_PER_HOUR);
    text = `${days}d ${hours}h`;
  } else if (msRemaining >= MS_PER_HOUR) {
    const hours = Math.floor(msRemaining / MS_PER_HOUR);
    const minutes = Math.floor((msRemaining % MS_PER_HOUR) / MS_PER_MINUTE);
    text = `${hours}h ${minutes}m`;
  } else {
    const minutes = Math.max(1, Math.ceil(msRemaining / MS_PER_MINUTE));
    text = `${minutes}m`;
  }

  return { text, urgency, isExpired: false, msRemaining };
}

export { Urgency };
export type { CountdownResult };
