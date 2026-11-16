import { StyleSheet } from 'react-native';
import { radii, spacing, type Colors } from '@/theme/tokens';

export const createLocationPickerStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
    hint: {
      position: 'absolute',
      top: spacing.xl,
      left: spacing.lg,
      right: spacing.lg,
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
    },
    panel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 18,
      gap: 10,
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
    },
    disabledMap: {
      position: 'absolute',
      top: 128,
      left: spacing.lg,
      right: spacing.lg,
      gap: spacing.md,
      alignItems: 'flex-start',
    },
  });
