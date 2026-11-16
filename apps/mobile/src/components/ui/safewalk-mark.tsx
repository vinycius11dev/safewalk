import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '@/theme/theme-provider';
import {
  resolveSafeWalkMarkColors,
  safeWalkMarkHeightRatio,
  type SafeWalkMarkTone,
} from './safewalk-mark.styles';

type SafeWalkMarkProps = {
  size: number;
  tone?: SafeWalkMarkTone;
};

/** Símbolo da marca: um caminho em S que sai do anel e chega ao ponto âmbar. */
export function SafeWalkMark({ size, tone = 'theme' }: SafeWalkMarkProps) {
  const { colors, mode } = useTheme();
  const { line, dot } = resolveSafeWalkMarkColors(tone, colors, mode);
  return (
    <Svg
      width={size}
      height={size * safeWalkMarkHeightRatio}
      viewBox="261 260 743 723"
      aria-hidden={true}
    >
      <Path
        d="M836 355H472a136 136 0 0 0 0 272H782a136 136 0 0 1 0 272H427"
        fill="none"
        stroke={line}
        strokeWidth={66}
      />
      <Circle cx={909} cy={355} r={74.5} fill="none" stroke={line} strokeWidth={41} />
      <Circle cx={345} cy={899} r={84} fill={dot} />
    </Svg>
  );
}
