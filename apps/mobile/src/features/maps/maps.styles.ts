import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';
export const createMapsStyles = (c: Colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    grow: { flex: 1, gap: 4 },
    gap: { gap: 12 },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: c.raised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    note: { backgroundColor: c.raised, padding: 12, borderRadius: 12, gap: 6 },
    choice: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    sourceLink: {
      color: c.primaryText,
      fontFamily: fonts.semibold,
      fontSize: 13,
      paddingVertical: 8,
    },
    miniMap: { height: 240, borderRadius: 16, overflow: 'hidden', backgroundColor: c.raised },
    homeActions: { position: 'absolute', top: 160, right: 16, gap: 10 },
    floating: {
      padding: 12,
      borderRadius: 24,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: { gap: 10, paddingVertical: 16 },
    small: { fontSize: 11, color: c.muted, lineHeight: 16 },
    fieldRow: { borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 12, gap: 5 },
  });
