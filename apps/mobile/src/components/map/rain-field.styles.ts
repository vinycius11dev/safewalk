import { StyleSheet } from 'react-native';
import { fonts, radii, spacing, type Colors } from '@/theme/tokens';
import type { MapRainStatus } from './real-map.types';

const dropPositions = [
  { left: '4%', top: '8%' },
  { left: '14%', top: '18%' },
  { left: '27%', top: '7%' },
  { left: '39%', top: '16%' },
  { left: '52%', top: '5%' },
  { left: '66%', top: '18%' },
  { left: '79%', top: '9%' },
  { left: '93%', top: '14%' },
  { left: '8%', top: '39%' },
  { left: '22%', top: '48%' },
  { left: '34%', top: '37%' },
  { left: '47%', top: '55%' },
  { left: '58%', top: '43%' },
  { left: '72%', top: '51%' },
  { left: '85%', top: '38%' },
  { left: '96%', top: '57%' },
  { left: '4%', top: '76%' },
  { left: '17%', top: '87%' },
  { left: '31%', top: '72%' },
  { left: '45%', top: '92%' },
  { left: '62%', top: '79%' },
  { left: '75%', top: '89%' },
  { left: '88%', top: '74%' },
  { left: '97%', top: '96%' },
];

export function createRainFieldStyles(colors: Colors, controlsTop: number, status: MapRainStatus) {
  const accent =
    status === 'raining' ? colors.primaryText : status === 'stale' ? colors.warning : colors.muted;
  const sheet = StyleSheet.create({
    root: { ...StyleSheet.absoluteFill },
    field: {
      ...StyleSheet.absoluteFill,
      overflow: 'hidden',
      zIndex: 1,
    },
    drop: {
      position: 'absolute',
      width: 1.4,
      height: 12,
      borderRadius: 2,
      backgroundColor: 'rgba(173, 211, 255, 0.5)',
      transform: [{ rotate: '18deg' }],
    },
    indicator: {
      position: 'absolute',
      top: controlsTop + spacing.sm,
      left: spacing.lg,
      zIndex: 2,
      minHeight: 32,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: accent,
      backgroundColor: 'rgba(12, 22, 37, 0.9)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    indicatorText: {
      color: accent,
      fontFamily: fonts.semibold,
      fontSize: 11,
      lineHeight: 15,
    },
  });

  const drops = dropPositions.map((position) => ({ ...sheet.drop, ...position }));
  return { ...sheet, drops };
}
