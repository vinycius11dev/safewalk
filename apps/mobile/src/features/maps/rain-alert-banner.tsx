import { useMemo } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import type { RainAlert } from './rain-alert';
import { createRainAlertStyles } from './rain-alert-banner.styles';

/** Rain warning over the map. The person can dismiss it; it comes back with the next rain. */
export function RainAlertBanner({
  alert,
  onDismiss,
  onLayout,
}: {
  alert: RainAlert;
  onDismiss: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createRainAlertStyles(colors), [colors]);
  return (
    <View
      style={s.banner}
      onLayout={onLayout}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={s.icon}>
        <Icon name="cloud-rain" size={18} color={colors.white} />
      </View>
      <View style={s.body}>
        <AppText style={s.title}>{alert.title}</AppText>
        <AppText style={s.message}>{alert.message}</AppText>
        {alert.nearest && <AppText style={s.nearest}>{alert.nearest}</AppText>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar aviso de chuva"
        onPress={onDismiss}
        style={s.close}
      >
        <Icon name="x" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
}
