import { StyleSheet } from 'react-native';
import { radii, spacing, type Colors } from '@/theme/tokens';

export const createRouteRecordsStyles = (c: Colors) =>
  StyleSheet.create({
    container: { gap: spacing.sm },
    reading: { gap: spacing.xs },
    headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
    compare: { flexDirection: 'row', gap: spacing.sm },
    option: {
      flex: 1,
      minHeight: 64,
      justifyContent: 'center',
      gap: 2,
      padding: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    optionSelected: { borderWidth: 2, borderColor: c.primaryText, backgroundColor: c.selected },
  });
