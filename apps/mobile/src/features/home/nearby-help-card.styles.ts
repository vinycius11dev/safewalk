import { StyleSheet } from 'react-native';
import { fonts, mapMarkerColors, radii, spacing, type Colors } from '@/theme/tokens';

const bubble = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export const createNearbyHelpStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: c.text },
    origin: { fontSize: 12, lineHeight: 16, color: c.muted },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
    rowPressed: { opacity: 0.7 },
    police: { ...bubble, backgroundColor: mapMarkerColors.police },
    health: { ...bubble, backgroundColor: mapMarkerColors.health },
    icon: { width: 22, height: 22 },
    body: { flex: 1, gap: 1 },
    kind: {
      fontFamily: fonts.semibold,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: c.muted,
    },
    name: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: c.text },
    distance: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: c.primaryText },
    calls: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
    call: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: c.raised,
    },
    callText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: c.text },
  });
