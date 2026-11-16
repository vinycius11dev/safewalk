import { useMemo, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createTransportModeSwitchStyles } from './transport-mode-switch.styles';

export type TransportMode = 'pedestrian' | 'wheelchair' | 'auto';

const modes: {
  value: TransportMode;
  label: string;
  spoken: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}[] = [
  { value: 'pedestrian', label: 'A pé', spoken: 'A pé', icon: 'walk' },
  {
    value: 'wheelchair',
    label: 'Cadeirante',
    spoken: 'A pé, com pessoa em cadeira de rodas',
    icon: 'wheelchair-accessibility',
  },
  { value: 'auto', label: 'Carro', spoken: 'De carro', icon: 'car' },
];

/** One tap to change how the trip is made; the route is recalculated by the screen. */
export function TransportModeSwitch({
  value,
  onChange,
}: {
  value: TransportMode;
  onChange: (mode: TransportMode) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createTransportModeSwitchStyles(colors), [colors]);
  return (
    <View style={s.group} accessibilityRole="radiogroup" accessibilityLabel="Como você vai?">
      {modes.map((mode) => {
        const selected = value === mode.value;
        return (
          <Pressable
            key={mode.value}
            style={[s.option, selected && s.optionSelected]}
            accessibilityRole="radio"
            accessibilityLabel={mode.spoken}
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(mode.value)}
          >
            <MaterialCommunityIcons
              name={mode.icon}
              size={18}
              color={selected ? colors.white : colors.text}
            />
            <AppText style={[s.label, selected && s.labelSelected]}>{mode.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
