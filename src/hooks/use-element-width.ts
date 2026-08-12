import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Tracks an element's inner width, padding included.
 */
const useElementWidth = (ref: RefObject<HTMLElement | null>): number | null => {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWidth(element.clientWidth);

    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return width;
};

export default useElementWidth;
