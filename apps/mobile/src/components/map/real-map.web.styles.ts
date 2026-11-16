import type { CSSProperties } from 'react';
import type { Colors } from '@/theme/tokens';

export function createWebMapStyle(
  colors: Colors,
  controlsTop: number,
  attributionTop: number,
): CSSProperties {
  return {
    '--map-background': colors.background,
    '--map-surface': colors.surface,
    '--map-border': colors.border,
    '--map-text': colors.text,
    '--map-muted': colors.muted,
    '--map-primary': colors.primary,
    '--map-controls-top': `${controlsTop}px`,
    '--map-attribution-top': `${attributionTop}px`,
  } as CSSProperties;
}
