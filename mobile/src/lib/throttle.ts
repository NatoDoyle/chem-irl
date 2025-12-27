/**
 * Throttle utility for limiting function execution rate
 *
 * Creates a throttled function that only invokes the callback at most once per
 * specified time period. If called multiple times during the throttle period,
 * only the first call executes immediately, subsequent calls are ignored until
 * the throttle period expires.
 *
 * @param callback - Function to throttle
 * @param delayMs - Minimum delay in milliseconds between executions
 * @returns Object with:
 *   - `execute()` - Execute the throttled callback (if throttle period has passed)
 *   - `cancel()` - Cancel any pending execution
 *   - `isThrottled()` - Check if currently throttled
 */
export interface Throttled {
  execute: () => void;
  cancel: () => void;
  isThrottled: () => boolean;
}

export function createThrottle(callback: () => void, delayMs: number): Throttled {
  let lastExecTime: number | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  const execute = () => {
    const now = Date.now();

    // If enough time has passed since last execution, execute immediately
    if (lastExecTime === null || now - lastExecTime >= delayMs) {
      lastExecTime = now;
      callback();
      return;
    }

    // Otherwise, schedule execution after remaining time
    const remainingTime = delayMs - (now - lastExecTime);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      lastExecTime = Date.now();
      timeoutId = null;
      callback();
    }, remainingTime);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const isThrottled = () => {
    if (lastExecTime === null) {
      return false;
    }
    const now = Date.now();
    return now - lastExecTime < delayMs;
  };

  return { execute, cancel, isThrottled };
}
