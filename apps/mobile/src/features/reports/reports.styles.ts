import { StyleSheet } from 'react-native';
import type { Colors } from '@/theme/tokens';
export const createReportStyles = (c: Colors) =>
  StyleSheet.create({
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    locationText: { flex: 1, gap: 5 },
    filters: { flexDirection: 'row', gap: 8 },
    filter: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: c.border,
    },
    filterActive: { borderBottomColor: c.primaryText },
    types: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    type: {
      width: '48%',
      minHeight: 86,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      gap: 10,
      backgroundColor: c.surface,
    },
    selected: { backgroundColor: c.selected, borderColor: c.primaryText },
    success: { alignItems: 'center', gap: 20, paddingTop: 60 },
    successIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: `${c.success}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: { textAlign: 'center' },
    photoPreview: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 14,
      marginTop: 12,
      backgroundColor: c.surface,
    },
  });
