import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import type { MapRainStatus } from './real-map.types';
import { createRainFieldStyles } from './rain-field.styles';
import { rainStatusDescription, rainStatusLabel } from './rain-status-copy';

export function RainField({
  status,
  controlsTop = 118,
}: {
  status: MapRainStatus | undefined;
  controlsTop?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => createRainFieldStyles(colors, controlsTop, status ?? 'unknown'),
    [colors, controlsTop, status],
  );
  const [reduceMotion, setReduceMotion] = useState(true);
  const [animation] = useState(() => new Animated.Value(0));
  const translateY = animation.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const animatedStyle = useMemo(() => ({ transform: [{ translateY }] }), [translateY]);

  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (status !== 'raining' || reduceMotion) {
      animation.stopAnimation();
      animation.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(animation, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animation, reduceMotion, status]);

  if (!status) return null;

  return (
    <View pointerEvents="none" style={styles.root}>
      {status === 'raining' && !reduceMotion && (
        <Animated.View
          style={[styles.field, animatedStyle]}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {styles.drops.map((style, index) => (
            <View key={index} style={style} />
          ))}
        </Animated.View>
      )}
      <View
        style={styles.indicator}
        accessibilityRole="text"
        accessibilityLabel={rainStatusDescription(status)}
      >
        <Icon
          name={status === 'stale' ? 'clock' : status === 'unknown' ? 'info' : 'cloud-rain'}
          size={15}
          color={
            status === 'raining'
              ? colors.primaryText
              : status === 'stale'
                ? colors.warning
                : colors.muted
          }
        />
        <AppText style={styles.indicatorText}>{rainStatusLabel(status)}</AppText>
      </View>
    </View>
  );
}
