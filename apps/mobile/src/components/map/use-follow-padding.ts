import { useMemo } from 'react';
import type { RealMapProps } from './real-map.types';

type Padding = NonNullable<RealMapProps['followPadding']>;

/** Keeps the follow padding stable while its values do not change, so the camera only moves on new positions. */
export function useFollowPadding(padding: RealMapProps['followPadding']): Padding | undefined {
  const top = padding?.top;
  const right = padding?.right;
  const bottom = padding?.bottom;
  const left = padding?.left;
  return useMemo(
    () =>
      top === undefined || right === undefined || bottom === undefined || left === undefined
        ? undefined
        : { top, right, bottom, left },
    [top, right, bottom, left],
  );
}
