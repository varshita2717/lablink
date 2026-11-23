import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const matches = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches);

/**
 * Tracks the user's reduced-motion preference.
 * @returns {boolean} True when the user asks for reduced motion.
 */
export default function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(matches);
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return undefined;
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}
