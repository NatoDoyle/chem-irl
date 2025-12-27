/**
 * Debounce utility for delaying function execution
 *
 * Creates a debounced function that delays invoking the callback until after
 * the specified delay has elapsed since the last time it was invoked.
 * If called again during the delay, the previous timeout is cancelled and a new one is set.
 *
 * @param callback - Function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Object with:
 *   - `execute()` - Execute the debounced callback
 *   - `cancel()` - Cancel any pending execution
 *   - `isPending()` - Check if there's a pending execution
 */
export interface Debounced {
  execute: () => void;
  cancel: () => void;
  isPending: () => boolean;
}

export function createDebounce(callback: () => void, delayMs: number): Debounced {
  let timeoutId: NodeJS.Timeout | null = null;

  const execute = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      callback();
    }, delayMs);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const isPending = () => {
    return timeoutId !== null;
  };

  return { execute, cancel, isPending };
}
