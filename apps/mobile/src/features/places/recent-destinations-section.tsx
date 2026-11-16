import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createFavoritePlacesStyles } from './favorite-places-section.styles';
import { createRecentDestinationStyles } from './recent-destinations-section.styles';
import type { RecentDestination } from './recent-destinations';

type Props = {
  places: readonly RecentDestination[];
  /** Texto da ação, por exemplo "Ir para" ou "Sair de". */
  verb: string;
  onSelect: (place: RecentDestination) => void;
  onRemove: (place: RecentDestination) => void;
  onClear: () => void;
};

/** Últimos destinos escolhidos, lidos do banco local do aparelho. */
export function RecentDestinationsSection({ places, verb, onSelect, onRemove, onClear }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createFavoritePlacesStyles(colors), [colors]);
  const r = useMemo(() => createRecentDestinationStyles(colors), [colors]);
  if (!places.length) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">
          Recentes
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar destinos recentes deste aparelho"
          style={s.manage}
          onPress={onClear}
        >
          <Text style={s.tileAction}>Limpar</Text>
        </Pressable>
      </View>
      <View style={s.list}>
        {places.map((place, index) => (
          <View key={place.key}>
            {index > 0 && <View style={s.rowDivider} />}
            <View style={s.rowWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${verb} ${place.label}`}
                style={({ pressed }) => [s.row, s.rowMain, pressed && s.rowPressed]}
                onPress={() => onSelect(place)}
              >
                <View style={r.bubble}>
                  <Icon name="clock" size={18} color={colors.primaryText} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowLabel} numberOfLines={2}>
                    {place.label}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remover ${place.label} dos recentes`}
                style={s.rowAction}
                onPress={() => onRemove(place)}
              >
                <Icon name="x" size={18} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
      <Text style={s.tileAddress}>Guardados só neste aparelho e apagados ao sair da conta.</Text>
    </View>
  );
}
