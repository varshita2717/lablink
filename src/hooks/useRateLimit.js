import { useCallback, useRef } from 'react';

/**
 * Client-side sliding-window rate limit.
 * @param {number} max Allowed actions per window.
 * @param {number} windowMs Window length in milliseconds.
 * @returns {() => boolean} `tryConsume`: records an action and returns false if over the limit.
 */
export default function useRateLimit(max, windowMs) {
  const timestamps = useRef([]);
  return useCallback(() => {
    const now = Date.now();
    timestamps.current = timestamps.current.filter((t) => now - t < windowMs);
    if (timestamps.current.length >= max) return false;
    timestamps.current.push(now);
    return true;
  }, [max, windowMs]);
}
