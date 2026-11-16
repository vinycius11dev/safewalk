import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';

export type SafeWalkBrandSize = 'compact' | 'regular';

export const safeWalkBrandMetrics = {
  compact: { mark: 48, wordmark: 25 },
  regular: { mark: 72, wordmark: 32 },
} as const;

export const createSafeWalkBrandStyles = (
  colors: Colors,
  size: SafeWalkBrandSize,
  showTagline: boolean,
  layout: 'horizontal' | 'stacked',
) => {
  const metrics = safeWalkBrandMetrics[size];

  return StyleSheet.create({
    root: {
      flexDirection: layout === 'stacked' ? 'column' : 'row',
      alignItems: 'center',
      gap: layout === 'stacked' ? 10 : 12,
      alignSelf: layout === 'stacked' ? 'center' : 'flex-start',
    },
    mark: {
      width: metrics.mark,
      height: metrics.mark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      gap: showTagline ? 4 : 0,
      alignItems: layout === 'stacked' ? 'center' : 'flex-start',
    },
    wordmark: {
      fontFamily: fonts.bold,
      fontSize: metrics.wordmark,
      lineHeight: metrics.wordmark + 4,
      letterSpacing: -1.2,
    },
    safe: {
      color: colors.text,
    },
    walk: {
      color: colors.primary,
    },
    tagline: {
      color: colors.muted,
      fontFamily: fonts.medium,
      fontSize: 12,
      lineHeight: 16,
    },
  });
};
