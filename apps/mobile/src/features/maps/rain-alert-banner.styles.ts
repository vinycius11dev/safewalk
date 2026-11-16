import { StyleSheet } from 'react-native';
import { fonts, mapMarkerColors, type Colors } from '@/theme/tokens';

export const createRainAlertStyles = (c: Colors) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
      paddingLeft: 12,
      paddingRight: 4,
      borderRadius: 16,
      backgroundColor: mapMarkerColors.floodsRaining,
      boxShadow: '0 6px 24px #00000050',
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${c.white}2E`,
    },
    body: { flex: 1, gap: 3 },
    title: { fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 19, color: c.white },
    message: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: c.white },
    nearest: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: c.white },
    close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  });
