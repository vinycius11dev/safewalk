import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useTheme } from '@/theme/theme-provider';
import { createAuthRouteIllustrationStyles } from './auth-route-illustration.styles';

export function AuthRouteIllustration({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createAuthRouteIllustrationStyles(), []);

  return (
    <View
      nativeID="safewalk-auth-route-illustration"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Ilustração de uma rota a pé por ruas da cidade, sem representar dados em tempo real"
      style={[styles.root, style]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 620 320"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden={true}
      >
        <G fill={colors.raised} opacity={0.7}>
          <Path d="M26 24h104l20 18-18 29H57L22 55Z" />
          <Path d="m190 28 64-13 23 20-8 41-67 9-27-25Z" />
          <Path d="m333 25 84 5 15 33-29 28-70-9-19-29Z" />
          <Path d="m477 28 92-12 23 25-16 38-84 16-30-25Z" />
          <Path d="m25 126 64-27 36 20-7 46-76 24-27-29Z" />
          <Path d="m168 122 70-18 25 25-9 42-71 22-31-34Z" />
          <Path d="m318 119 65-20 31 26-10 44-72 21-29-29Z" />
          <Path d="m469 123 93-17 23 27-17 42-80 17-34-35Z" />
          <Path d="m40 235 79-30 31 23-12 45-73 24-32-31Z" />
          <Path d="m195 224 76-30 28 25-11 45-73 24-33-31Z" />
          <Path d="m361 223 69-31 33 22-8 46-78 26-30-29Z" />
          <Path d="m511 222 78-27 28 23-10 46-76 25-30-31Z" />
        </G>

        <G
          fill="none"
          stroke={colors.border}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M-30 88c68 12 107-25 176-17s103 52 173 34 111-49 175-34 92 36 160 4" />
          <Path d="M-28 192c76 2 108-38 174-23s106 45 171 23 105-37 172-21 97 38 156 8" />
          <Path d="M-22 286c69-7 107-39 174-24s96 43 168 22 119-47 184-24 94 29 156-2" />
          <Path d="M77-20c14 59-12 88-5 138s29 81 19 130 2 70 16 105" />
          <Path d="M211-23c-12 58 11 87 2 135s-25 77-8 124-1 78-19 103" />
          <Path d="M365-20c13 51-10 89-2 132s25 79 9 124 0 82 18 107" />
          <Path d="M522-20c-8 54 17 82 7 133s-28 78-11 126-4 75-19 105" />
        </G>

        <Path
          d="M76 274c31-7 35-46 76-47l72 1c38 0 40-45 79-52l59-11c38-7 26-50 64-59l63-15c38-9 32-39 63-47"
          fill="none"
          stroke={colors.white}
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M76 274c31-7 35-46 76-47l72 1c38 0 40-45 79-52l59-11c38-7 26-50 64-59l63-15c38-9 32-39 63-47"
          fill="none"
          stroke={colors.primary}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Circle cx={76} cy={274} r={16} fill={colors.white} />
        <Circle
          cx={76}
          cy={274}
          r={11}
          fill={colors.white}
          stroke={colors.primary}
          strokeWidth={4}
        />
        <Circle cx={76} cy={274} r={4} fill={colors.primary} />
        <Path
          d="M536 43c0-12 9-21 21-21s21 9 21 21c0 15-21 40-21 40s-21-25-21-40Z"
          fill={colors.primary}
          stroke={colors.white}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <Circle cx={557} cy={43} r={6} fill={colors.white} />
      </Svg>
    </View>
  );
}
