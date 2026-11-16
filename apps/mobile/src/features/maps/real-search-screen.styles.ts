import { StyleSheet } from 'react-native';
import { fonts, radii, spacing, type Colors } from '@/theme/tokens';

export function createRealSearchStyles(c: Colors) {
  return StyleSheet.create({
    savingIntro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: c.raised,
    },
    savingBody: { flex: 1, gap: spacing.xs },
    currentLocationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    searchSection: { gap: spacing.md },
    sectionTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: c.text },
    resultList: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    resultDivider: { height: 1, marginLeft: 64, backgroundColor: c.border },
    resultRow: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs },
    resultMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 68,
      paddingLeft: spacing.md,
      paddingVertical: spacing.sm,
    },
    resultPressed: { backgroundColor: c.raised },
    resultIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    resultBody: { flex: 1, gap: 1 },
    resultName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: c.text },
    resultAddress: { fontSize: 12, lineHeight: 17, color: c.muted },
    resultSaved: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: c.primaryText },
    favoriteToggle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 68,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    footnote: { textAlign: 'center' },
  });
}
