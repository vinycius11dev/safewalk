import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';
export const createContactStyles = (c: Colors) =>
  StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: '#8057EF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSecond: { backgroundColor: '#009F77' },
    avatarText: { fontFamily: fonts.bold, fontSize: 18, color: c.white },
    body: { flex: 1, gap: 4 },
    actions: { flexDirection: 'row', gap: 18, paddingTop: 10 },
    delete: { padding: 8 },
  });
