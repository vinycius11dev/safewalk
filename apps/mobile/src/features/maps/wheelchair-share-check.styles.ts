import { StyleSheet } from 'react-native';
import { radii, spacing, type Colors } from '@/theme/tokens';

export const createWheelchairShareCheckStyles = (colors: Colors) =>
  StyleSheet.create({
    check: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    checkOn: { borderColor: colors.primaryText, backgroundColor: colors.selected },
    body: { flex: 1 },
  });
