import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';

export const createCompanionStyles = (c: Colors) =>
  StyleSheet.create({
    contact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderColor: c.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#8057EF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarSecond: { backgroundColor: '#009F77' },
    avatarText: { color: c.white, fontFamily: fonts.bold, fontSize: 19 },
    pending: { opacity: 0.6 },
    notice: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: c.raised,
      padding: 16,
      borderRadius: 14,
    },
  });
