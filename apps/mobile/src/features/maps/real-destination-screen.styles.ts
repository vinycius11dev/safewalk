import { StyleSheet } from 'react-native';
import { radii, spacing, type Colors } from '@/theme/tokens';

export const createRealDestinationStyles = (colors: Colors) =>
  StyleSheet.create({
    map: { flex: 1 },
    instruction: {
      position: 'absolute',
      top: spacing.lg,
      left: spacing.lg,
      right: spacing.lg,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '54%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
    },
    panelContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
    blocked: { padding: spacing.xl, gap: spacing.lg },
    handle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
      alignSelf: 'center',
    },
  });
