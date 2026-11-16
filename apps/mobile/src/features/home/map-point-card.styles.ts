import { StyleSheet } from 'react-native';
import { favoriteColors, fonts, radii, spacing, type Colors } from '@/theme/tokens';

export const createMapPointCardStyles = (c: Colors) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: c.primary,
      backgroundColor: c.surface,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    pin: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: favoriteColors.home,
    },
    body: { flex: 1, gap: 2 },
    overline: {
      fontFamily: fonts.semibold,
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: c.muted,
    },
    address: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: c.text },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    actions: { flexDirection: 'row', gap: spacing.sm },
    action: { flex: 1 },
  });
