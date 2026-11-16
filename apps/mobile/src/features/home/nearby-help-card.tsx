import { useMemo } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import type { Coordinates } from '@safewalk/contracts';
import { Icon } from '@/components/ui/primitives';
import { recordIconImages } from '@/components/map/record-icons';
import { useTheme } from '@/theme/theme-provider';
import { formatStraightDistance, placeName, type NearbyPlace } from '@/features/maps/nearby-places';
import { createNearbyHelpStyles } from './nearby-help-card.styles';

type Props = {
  places: readonly NearbyPlace[];
  /** True when the distances are from the person's GPS; otherwise from the map center. */
  fromDevice: boolean;
  onGo: (location: Coordinates, label: string) => void;
};

const kindLabels = { police: 'Delegacia', health: 'Hospital' } as const;

/** Nearest police station and hospital, with "go there" and the emergency numbers. */
export function NearbyHelpCard({ places, fromDevice, onGo }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createNearbyHelpStyles(colors), [colors]);
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">
          Ajuda por perto
        </Text>
        <Text style={s.origin}>{fromDevice ? 'de você, em linha reta' : 'do centro do mapa'}</Text>
      </View>
      {places.map((place) => {
        const name = placeName(place.feature);
        const distance = formatStraightDistance(place.distanceMeters);
        return (
          <Pressable
            key={place.kind}
            accessibilityRole="button"
            accessibilityLabel={`${kindLabels[place.kind]} mais perto: ${name}, a ${distance} em linha reta. Toque para ir até lá.`}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
            onPress={() => onGo(place.location, name)}
          >
            <View style={s[place.kind]}>
              <Image source={recordIconImages[place.kind]} style={s.icon} />
            </View>
            <View style={s.body}>
              <Text style={s.kind}>{kindLabels[place.kind]}</Text>
              <Text style={s.name} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <Text style={s.distance}>{distance}</Text>
            <Icon name="navigation" size={18} color={colors.primaryText} />
          </Pressable>
        );
      })}
      <View style={s.calls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ligar 190, Polícia Militar"
          style={s.call}
          onPress={() => void Linking.openURL('tel:190').catch(() => undefined)}
        >
          <Icon name="phone" size={15} color={colors.text} />
          <Text style={s.callText}>190 Polícia</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ligar 192, SAMU"
          style={s.call}
          onPress={() => void Linking.openURL('tel:192').catch(() => undefined)}
        >
          <Icon name="phone" size={15} color={colors.text} />
          <Text style={s.callText}>192 SAMU</Text>
        </Pressable>
      </View>
    </View>
  );
}
