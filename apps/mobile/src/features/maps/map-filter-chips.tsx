import { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { UrbanLayerType } from '@safewalk/contracts';
import { Icon } from '@/components/ui/primitives';
import { recordIconImages } from '@/components/map/record-icons';
import { useTheme } from '@/theme/theme-provider';
import { useMapLayers } from './use-map-journey';
import { FLOOD_LAYERS } from './flood-layers';
import { createMapFilterStyles, filterBubbleColors } from './map-filter-chips.styles';

const FILTERS = [
  { id: 'police', types: ['police'], label: 'Delegacias', icon: 'police' },
  { id: 'health', types: ['health'], label: 'Hospitais', icon: 'health' },
  { id: 'crossings', types: ['crossings'], label: 'Semáforos', icon: 'signals' },
  { id: 'sp156', types: ['sp156'], label: 'Solicitações', icon: 'reports' },
  { id: 'floods', types: FLOOD_LAYERS, label: 'Alagamentos', icon: 'floods' },
] as const satisfies readonly {
  id: keyof typeof filterBubbleColors;
  types: readonly UrbanLayerType[];
  label: string;
  icon: keyof typeof recordIconImages;
}[];

/**
 * One-tap layer switches over the map, with the same pictograms as the markers. While the
 * weather model shows rain, flood layers stay on and the switch says so.
 */
export function MapFilterChips({ raining }: { raining: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createMapFilterStyles(colors), [colors]);
  const { layers, setGroup } = useMapLayers();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.scroll}
      contentContainerStyle={s.row}
    >
      {FILTERS.map((filter) => {
        const forced = raining && filter.id === 'floods';
        const on = forced || filter.types.some((type) => layers.includes(type));
        return (
          <Pressable
            key={filter.id}
            accessibilityRole="switch"
            accessibilityLabel={`${filter.label} no mapa`}
            accessibilityHint={forced ? 'Ligado automaticamente enquanto chove.' : undefined}
            accessibilityState={{ checked: on, disabled: forced }}
            aria-checked={on}
            disabled={forced}
            style={({ pressed }) => [
              s.chip,
              on ? s.chipOn : s.chipOff,
              forced && s.chipRain,
              pressed && s.chipPressed,
            ]}
            onPress={() => setGroup(filter.types, !on)}
          >
            <View style={[s.bubble, on ? filterBubbleColors[filter.id] : s.bubbleOff]}>
              <Image source={recordIconImages[filter.icon]} style={s.icon} />
            </View>
            <Text style={s.label}>{filter.label}</Text>
            {forced && (
              <View style={s.rainTag}>
                <Icon name="cloud-rain" size={12} color={colors.white} />
                <Text style={s.rainTagText}>chuva</Text>
              </View>
            )}
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mais camadas do mapa"
        style={s.more}
        onPress={() => router.push('/camadas-mapa')}
      >
        <Icon name="sliders" size={17} color={colors.primaryText} />
      </Pressable>
    </ScrollView>
  );
}
