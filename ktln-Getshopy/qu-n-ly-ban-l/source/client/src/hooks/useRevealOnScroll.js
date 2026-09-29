import { useRef, useState, useEffect } from 'react';

/**
 * useRevealOnScroll — triggers a one-time reveal animation when an element
 * scrolls into the viewport.
 *
 * Technique: IntersectionObserver (W3C Intersection Observer API)
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver
 *
 * @param {Object} options
 * @param {number} options.threshold — fraction of element visible to trigger (0–1)
 * @param {string} options.rootMargin — margin around root (e.g. '0px 0px -40px 0px')
 * @returns {[React.RefObject, boolean]} [ref, isVisible]
 */
export default function useRevealOnScroll({ threshold = 0.12, rootMargin = '0px 0px -40px 0px' } = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // fire once
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, isVisible];
}

/**
 * Inline style helper for reveal animation.
 * Use with useRevealOnScroll:
 *
 *   const [ref, vis] = useRevealOnScroll();
 *   <div ref={ref} style={revealStyle(vis, { delay: 100 })}>...</div>
 *
 * @param {boolean} isVisible
 * @param {Object}  opts
 * @param {number}  opts.delay — ms delay before animation starts
 * @param {number}  opts.distance — px to translate from (default 24)
 * @param {number}  opts.duration — ms for transition (default 600)
 */
export function revealStyle(isVisible, { delay = 0, distance = 24, duration = 600 } = {}) {
  return {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : `translateY(${distance}px)`,
    transition: `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
  };
}
