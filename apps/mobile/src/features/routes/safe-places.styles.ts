import { StyleSheet } from 'react-native';
import { fonts, type Colors } from '@/theme/tokens';

export const createSafePlacesStyles = (c: Colors) =>
  StyleSheet.create({
    map: { height: 220, overflow: 'hidden', borderRadius: 18, backgroundColor: c.raised },
    marker: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.success,
      borderWidth: 3,
      borderColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedMarker: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      borderColor: c.white,
    },
    markerText: { color: c.white, fontFamily: fonts.bold, fontSize: 14 },
    pinOne: { left: '24%', top: '28%' },
    pinTwo: { left: '48%', top: '45%' },
    pinThree: { left: '70%', top: '18%' },
    // Right of the "Av. Paulista" street label, still on the avenue.
    pinFour: { left: '80%', top: '50%' },
    row: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 15,
      alignItems: 'center',
      backgroundColor: c.surface,
    },
    selectedRow: { borderColor: c.primaryText, backgroundColor: c.selected },
    number: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: `${c.success}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, gap: 3 },
    meta: { fontSize: 12, lineHeight: 17, color: c.muted },
  });
