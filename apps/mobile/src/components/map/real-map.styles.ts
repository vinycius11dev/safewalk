import { StyleSheet } from 'react-native';
import { fonts, radii, spacing, type Colors } from '@/theme/tokens';

export function createRealMapStyles(colors: Colors, controlsTop = 118, attributionTop = 80) {
  return StyleSheet.create({
    root: { ...StyleSheet.absoluteFill, backgroundColor: colors.background },
    canvas: { flex: 1 },
    controls: { position: 'absolute', top: controlsTop, right: spacing.lg, gap: spacing.sm },
    control: {
      width: 42,
      height: 42,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    mode: { color: colors.primaryText, fontFamily: fonts.bold, fontSize: 12 },
    attributionPosition: { top: attributionTop, left: 16 },
    status: {
      position: 'absolute',
      top: controlsTop + spacing.sm,
      left: spacing.lg,
      right: 70,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
    },
    fallback: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xxl,
      gap: spacing.md,
    },
  });
}
