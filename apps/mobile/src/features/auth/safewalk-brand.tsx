import { useMemo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeWalkMark } from '@/components/ui/safewalk-mark';
import { useTheme } from '@/theme/theme-provider';
import {
  createSafeWalkBrandStyles,
  safeWalkBrandMetrics,
  type SafeWalkBrandSize,
} from './safewalk-brand.styles';

type SafeWalkBrandProps = {
  size?: SafeWalkBrandSize;
  layout?: 'horizontal' | 'stacked';
  showTagline?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SafeWalkBrand({
  size = 'regular',
  layout = 'horizontal',
  showTagline = true,
  style,
}: SafeWalkBrandProps) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => createSafeWalkBrandStyles(colors, size, showTagline, layout),
    [colors, size, showTagline, layout],
  );
  const markSize = safeWalkBrandMetrics[size].mark;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="SafeWalk, rotas a pé com mais informação"
      style={[styles.root, style]}
    >
      <View style={styles.mark}>
        <SafeWalkMark size={markSize} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.wordmark}>
          <Text style={styles.safe}>Safe</Text>
          <Text style={styles.walk}>Walk</Text>
        </Text>
        {showTagline ? <Text style={styles.tagline}>São Paulo, passo a passo.</Text> : null}
      </View>
    </View>
  );
}
