import { useEffect, useState } from 'react';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/**
 * Scroll progress through a tall container whose child is `position: sticky`: 0 when the
 * container's top reaches the viewport top, 1 when its bottom reaches the viewport bottom.
 * Uses a passive scroll listener and one requestAnimationFrame per frame; never blocks scrolling.
 * @param {import('react').RefObject<HTMLElement>} ref The tall container.
 * @param {boolean} enabled False (e.g. reduced motion) keeps progress at 0 and adds no listeners.
 * @returns {number} Progress from 0 to 1.
 */
export default function useScrollProgress(ref, enabled = true) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      setProgress(distance > 0 ? clamp01(-rect.top / distance) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);

  return enabled ? progress : 0;
}
