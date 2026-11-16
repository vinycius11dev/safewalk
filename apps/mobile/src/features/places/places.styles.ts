import { StyleSheet } from 'react-native';
import type { Colors } from '@/theme/tokens';
export const createPlacesStyles = (c: Colors) =>
  StyleSheet.create({
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    placeIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.selected,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeBody: { flex: 1, gap: 2 },
    rowAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    choiceRow: { flexDirection: 'row', gap: 10 },
    choice: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      gap: 4,
    },
    optionSelected: { borderColor: c.primary, backgroundColor: c.selected },
    resultRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 2,
    },
    sectionLabel: { marginTop: 14, fontSize: 11, letterSpacing: 1.2, color: c.muted },
    form: { gap: 12 },
  });
