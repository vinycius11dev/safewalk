import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Largura real do elemento, em pixels. Os gráficos são desenhados nessa medida para que texto
 * e traço não estiquem junto com a tela.
 */
export function useElementWidth<T extends HTMLElement>(
  fallback: number,
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
