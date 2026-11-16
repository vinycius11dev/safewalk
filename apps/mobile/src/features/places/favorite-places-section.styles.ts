import { StyleSheet, type ViewStyle } from 'react-native';
import { favoriteColors, fonts, radii, spacing, type Colors } from '@/theme/tokens';
import type { SavedPlaceKind } from '@safewalk/contracts';

export const createFavoritePlacesStyles = (c: Colors) =>
  StyleSheet.create({
    section: { gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { flex: 1, fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: c.text },
    counter: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: c.muted },
    manage: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
    shortcuts: { flexDirection: 'row', gap: spacing.md },
    tile: {
      flex: 1,
      minHeight: 116,
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
    },
    tileEmpty: {
      borderStyle: 'dashed',
      borderWidth: 2,
      borderColor: c.primary,
      backgroundColor: c.selected,
      boxShadow: 'none',
    },
    tilePressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
    tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tileLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: c.text },
    tileAddress: { fontSize: 12, lineHeight: 17, color: c.muted },
    tileAction: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: c.primaryText },
    plusBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    list: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 64,
      paddingLeft: spacing.md,
      paddingRight: spacing.xs,
    },
    rowWrap: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs },
    rowMain: { flex: 1 },
    rowPressed: { backgroundColor: c.raised },
    rowDivider: { height: 1, marginLeft: 64, backgroundColor: c.border },
    rowBody: { flex: 1, gap: 1, paddingVertical: spacing.sm },
    rowLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: c.text },
    rowAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: c.primary,
    },
    addLabel: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: c.primaryText },
    disabled: { opacity: 0.55 },
  });

const bubble = {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** Círculo colorido do favorito; a cor depende do tipo. */
export const favoriteBubbleStyles: Record<SavedPlaceKind | 'map', ViewStyle> = StyleSheet.create({
  home: { ...bubble, backgroundColor: favoriteColors.home },
  work: { ...bubble, backgroundColor: favoriteColors.work },
  other: { ...bubble, backgroundColor: favoriteColors.other },
  map: { ...bubble, backgroundColor: favoriteColors.map },
});
