import { createDebounce } from '../debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('delays execution until after the delay period', () => {
    const callback = jest.fn();
    const debounced = createDebounce(callback, 100);

    debounced.execute();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels previous execution when called again during delay', () => {
    const callback = jest.fn();
    const debounced = createDebounce(callback, 100);

    debounced.execute();
    jest.advanceTimersByTime(50);
    debounced.execute();
    jest.advanceTimersByTime(50);

    // Should not have been called yet (first call cancelled, second is still pending)
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('batches multiple rapid calls into a single invocation', () => {
    const callback = jest.fn();
    const debounced = createDebounce(callback, 100);

    debounced.execute();
    debounced.execute();
    debounced.execute();
    debounced.execute();

    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('allows cancel to prevent invocation', () => {
    const callback = jest.fn();
    const debounced = createDebounce(callback, 100);

    debounced.execute();
    expect(debounced.isPending()).toBe(true);

    debounced.cancel();
    expect(debounced.isPending()).toBe(false);

    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
  });

  it('isPending returns false when no execution is pending', () => {
    const callback = jest.fn();
    const debounced = createDebounce(callback, 100);

    expect(debounced.isPending()).toBe(false);

    debounced.execute();
    expect(debounced.isPending()).toBe(true);

    jest.advanceTimersByTime(100);
    expect(debounced.isPending()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('handles cancel when nothing is pending', () => {
    const callback = jest.fn();
    const debounced = createDebounce(callback, 100);

    expect(() => debounced.cancel()).not.toThrow();
    expect(debounced.isPending()).toBe(false);
  });

  it('handles multiple execute-cancel cycles', () => {
    const callback = jest.fn();
    const debounced = createDebounce(callback, 100);

    debounced.execute();
    debounced.cancel();
    debounced.execute();
    debounced.cancel();

    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
  });
});
