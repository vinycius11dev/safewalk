import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';

export const createSosButtonStyles = (c: Colors) =>
  StyleSheet.create({
    button: {
      minHeight: 64,
      borderRadius: 32,
      backgroundColor: c.dangerButton,
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.8 },
    title: { color: c.white, fontFamily: fonts.extrabold, fontSize: 25, lineHeight: 30 },
    white: { color: c.white },
    overlay: {
      flex: 1,
      backgroundColor: '#000000B3',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    dialog: {
      width: '100%',
      maxWidth: 360,
      padding: 24,
      backgroundColor: c.surface,
      borderRadius: 22,
      gap: 18,
    },
  });
