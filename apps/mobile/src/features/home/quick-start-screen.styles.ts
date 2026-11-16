import { StyleSheet } from 'react-native';
import { radii, spacing, type Colors } from '@/theme/tokens';
export const createQuickStartStyles = (c: Colors) =>
  StyleSheet.create({
    placeCard: { gap: spacing.xs },
    placeTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    routeCard: {
      borderWidth: 1,
      borderColor: c.primary,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.xs,
      backgroundColor: c.selected,
    },
    contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    contactChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    optionSelected: { borderColor: c.primary, backgroundColor: c.selected },
    sectionLabel: { fontSize: 11, letterSpacing: 1.2, color: c.muted },
    form: { gap: spacing.md },
  });
