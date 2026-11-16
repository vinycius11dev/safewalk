import { StyleSheet } from 'react-native';
import { radii, spacing, type Colors } from '@/theme/tokens';
export const createTimerSetupStyles = (c: Colors) =>
  StyleSheet.create({
    choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    choice: {
      minWidth: '30%',
      flexGrow: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    optionSelected: { borderColor: c.primary, backgroundColor: c.selected },
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
    sectionLabel: { marginTop: spacing.sm, fontSize: 11, letterSpacing: 1.2, color: c.muted },
    form: { gap: spacing.md },
  });
