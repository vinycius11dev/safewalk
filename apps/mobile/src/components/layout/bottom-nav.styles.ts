import { StyleSheet } from 'react-native';
import type { Colors } from '@/theme/tokens';
import { fonts } from '@/theme/tokens';
export const createNavStyles = (c: Colors) =>
  StyleSheet.create({
    nav: {
      minHeight: 76,
      paddingTop: 10,
      paddingBottom: 8,
      paddingHorizontal: 6,
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
    label: {
      fontFamily: fonts.medium,
      fontSize: 11,
      lineHeight: 16,
      textAlign: 'center',
      color: c.muted,
    },
    activeLabel: { color: c.primaryText },
  });
