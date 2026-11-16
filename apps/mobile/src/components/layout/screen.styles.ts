import { StyleSheet } from 'react-native';
import type { Colors } from '@/theme/tokens';
export const createScreenStyles = (c: Colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    keyboardRoot: { flex: 1 },
    header: {
      minHeight: 64,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    heading: { flex: 1 },
    content: { padding: 20, paddingBottom: 30, gap: 20 },
    body: { flex: 1 },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  });
