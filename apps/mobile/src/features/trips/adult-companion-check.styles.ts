import { StyleSheet } from 'react-native';
import { fonts, radii, spacing, type Colors } from '@/theme/tokens';

export const createAdultCompanionCheckStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.warning,
      backgroundColor: `${c.warning}1F`,
    },
    header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.warning,
    },
    body: { flex: 1, gap: 2 },
    title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: c.text },
    check: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    checkOn: { borderColor: c.primary, backgroundColor: c.selected },
    checkPressed: { opacity: 0.85 },
    checkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: c.text },
  });
