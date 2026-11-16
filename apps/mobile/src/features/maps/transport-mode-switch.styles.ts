import { StyleSheet } from 'react-native';
import { fonts, radii, spacing, type Colors } from '@/theme/tokens';

export const createTransportModeSwitchStyles = (colors: Colors) =>
  StyleSheet.create({
    group: {
      flexDirection: 'row',
      gap: spacing.xs,
      padding: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: colors.raised,
    },
    option: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      alignContent: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: radii.sm,
    },
    optionSelected: { backgroundColor: colors.primary },
    label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    labelSelected: { color: colors.white },
  });
