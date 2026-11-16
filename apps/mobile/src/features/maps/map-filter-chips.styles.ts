import { StyleSheet } from 'react-native';
import { fonts, mapMarkerColors, type Colors } from '@/theme/tokens';

export const createMapFilterStyles = (c: Colors) =>
  StyleSheet.create({
    // Horizontal strip inside the screen width (no negative margin: content wider than the screen
    // would let the browser scroll the whole app sideways when a chip receives focus).
    scroll: { flexGrow: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingRight: 4 },
    chip: {
      minHeight: 36,
      paddingLeft: 4,
      paddingRight: 12,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: c.surface,
      boxShadow: '0 4px 14px #00000030',
    },
    chipOff: { opacity: 0.72, borderColor: c.border, boxShadow: 'none' },
    chipOn: { borderColor: c.primary },
    chipPressed: { transform: [{ scale: 0.96 }] },
    chipRain: { borderColor: mapMarkerColors.floodsRaining },
    rainTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginLeft: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: mapMarkerColors.floodsRaining,
    },
    rainTagText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, color: c.white },
    bubble: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bubbleOff: { backgroundColor: c.raised },
    icon: { width: 18, height: 18 },
    label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: c.text },
    more: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      boxShadow: '0 4px 14px #00000030',
    },
  });

/** Bubble background of a filter, matching the map marker of the same category. */
export const filterBubbleColors = StyleSheet.create({
  police: { backgroundColor: mapMarkerColors.police },
  health: { backgroundColor: mapMarkerColors.health },
  crossings: { backgroundColor: mapMarkerColors.signals },
  sp156: { backgroundColor: mapMarkerColors.reports },
  floods: { backgroundColor: mapMarkerColors.floods },
});
