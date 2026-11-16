import { StyleSheet } from 'react-native';
import { spacing, radii, type Colors } from '@/theme/tokens';
export const createRouteConditionsStyles = (c: Colors) =>
  StyleSheet.create({
    section: { gap: spacing.sm, paddingVertical: spacing.sm },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    dot: { width: 9, height: 9, borderRadius: 5 },
    yellow: { backgroundColor: c.warning },
    red: { backgroundColor: c.danger },
    blue: { backgroundColor: c.primaryText },
    gray: { backgroundColor: c.muted },
    weather: {
      gap: spacing.xs,
      backgroundColor: c.raised,
      padding: spacing.md,
      borderRadius: radii.sm,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.18)',
      paddingTop: 24,
    },
    sheet: {
      maxHeight: '85%',
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      backgroundColor: c.surface,
      padding: spacing.lg,
      gap: spacing.md,
    },
    scroll: { flexShrink: 1 },
    areaSheet: { maxHeight: '45%' },
    body: { gap: spacing.md, paddingBottom: spacing.md },
  });
