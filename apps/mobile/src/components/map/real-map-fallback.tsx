import { useMemo } from 'react';
import { View } from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createRealMapStyles } from './real-map.styles';

export function RealMapFallback({
  message,
  title = 'Mapa indisponível',
}: {
  message: string;
  title?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createRealMapStyles(colors), [colors]);
  return (
    <View style={styles.fallback} accessibilityRole="alert">
      <Icon name="map" size={30} color={colors.muted} />
      <AppText variant="subtitle">{title}</AppText>
      <AppText tone="muted">{message}</AppText>
    </View>
  );
}
