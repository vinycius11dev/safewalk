import { StyleSheet } from 'react-native';
import { mapMarkerColors, spacing } from '@/theme/tokens';

const bubble = {
  width: 26,
  height: 26,
  borderRadius: 13,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export const mapIconLegendStyles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  icon: { width: 16, height: 16 },
  signals: { ...bubble, backgroundColor: mapMarkerColors.signals },
  reports: { ...bubble, backgroundColor: mapMarkerColors.reports },
  floods: { ...bubble, backgroundColor: mapMarkerColors.floods },
  sidewalks: { ...bubble, backgroundColor: mapMarkerColors.sidewalks },
  lighting: { ...bubble, backgroundColor: mapMarkerColors.lighting },
  accessibility: { ...bubble, backgroundColor: mapMarkerColors.accessibility },
  police: { ...bubble, backgroundColor: mapMarkerColors.police },
  health: { ...bubble, backgroundColor: mapMarkerColors.health },
  history: { ...bubble, backgroundColor: mapMarkerColors.history },
  potholes: { ...bubble, backgroundColor: mapMarkerColors.potholes },
  obstacles: { ...bubble, backgroundColor: mapMarkerColors.obstacles },
  brokenSidewalk: { ...bubble, backgroundColor: mapMarkerColors.brokenSidewalk },
  drains: { ...bubble, backgroundColor: mapMarkerColors.drains },
  trees: { ...bubble, backgroundColor: mapMarkerColors.trees },
});
