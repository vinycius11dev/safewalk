import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';

export const createAuthFieldStyles = (c: Colors, compact: boolean) =>
  StyleSheet.create({
    root: { gap: compact ? 6 : 8 },
    label: { color: c.text, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
    control: {
      minHeight: compact ? 50 : 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.white,
    },
    focused: { borderColor: c.primary },
    input: {
      flex: 1,
      minWidth: 0,
      minHeight: compact ? 48 : 54,
      paddingVertical: 10,
      paddingHorizontal: 0,
      color: c.text,
      fontFamily: fonts.regular,
      fontSize: 15,
    },
    toggle: { minWidth: 38, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    togglePressed: { opacity: 0.6 },
  });
