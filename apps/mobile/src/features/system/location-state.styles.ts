import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';
export const createLocationStateStyles = (c: Colors) =>
  StyleSheet.create({
    content: { paddingTop: 32, gap: 20 },
    icon: {
      alignSelf: 'center',
      width: 90,
      height: 90,
      borderRadius: 45,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    title: { textAlign: 'center', fontFamily: fonts.extrabold, fontSize: 29, lineHeight: 36 },
    description: { textAlign: 'center', color: c.muted },
    step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    number: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.selected,
    },
    body: { flex: 1 },
  });
