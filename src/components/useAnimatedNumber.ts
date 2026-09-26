import { useEffect, useRef, useState } from 'react';

/**
 * Eases a displayed number toward `target`. If the target changes mid-animation,
 * the next animation starts from the value currently on screen. Respects
 * prefers-reduced-motion by jumping straight to the target.
 */
export function useAnimatedNumber(target: number, durationMs = 450): number {
  const [value, setValue] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    const from = currentRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || from === target) {
      currentRef.current = target;
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      currentRef.current = from + (target - from) * eased;
      setValue(currentRef.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
