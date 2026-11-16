import { StyleSheet, type Animated, type DimensionValue } from 'react-native';
import { radii, spacing, type Colors } from '@/theme/tokens';

/**
 * Estilos animados do painel a partir do progresso (1 = aberto, 0 = minimizado).
 * `travel` é a distância em px que o painel desce para deixar à vista só a parte fixa.
 */
export const createSheetMotionStyles = (progress: Animated.Value, travel: number) => ({
  sheet: {
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [travel, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  },
  details: {
    opacity: progress.interpolate({
      inputRange: [0.25, 0.85],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
  },
  summary: {
    opacity: progress.interpolate({
      inputRange: [0, 0.45],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    }),
  },
  chevron: {
    transform: [
      {
        rotate: progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['180deg', '0deg'],
          extrapolate: 'clamp',
        }),
      },
    ],
  },
});

export const sheetFrameStyles = (maxHeight: DimensionValue, footerHeight: number) =>
  StyleSheet.create({
    sheet: { maxHeight },
    footerSpace: { height: footerHeight },
  });

export const createCollapsibleSheetStyles = (c: Colors) =>
  StyleSheet.create({
    clip: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      overflow: 'hidden',
      pointerEvents: 'box-none',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      boxShadow: '0px -6px 24px rgba(15, 23, 42, 0.12)',
    },
    unmeasured: { opacity: 0 },
    handle: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingTop: spacing.sm,
    },
    handleBar: { width: 38, height: 4, borderRadius: 3, backgroundColor: c.border },
    handleLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    body: { flexShrink: 1 },
    summary: { position: 'absolute', top: 0, left: 0, right: 0 },
    scroll: { flexShrink: 1 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: c.surface },
    interactive: { pointerEvents: 'auto' },
    passThrough: { pointerEvents: 'box-none' },
    inert: { pointerEvents: 'none' },
  });
