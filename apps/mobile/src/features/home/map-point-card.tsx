import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppText, Button, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createMapPointCardStyles } from './map-point-card.styles';

type Props = {
  address: string | null;
  loading: boolean;
  onGo: () => void;
  onStartHere: () => void;
  onClose: () => void;
};

/** Point picked with a long press on the map, with the Waze-style "go here" actions. */
export function MapPointCard({ address, loading, onGo, onStartHere, onClose }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createMapPointCardStyles(colors), [colors]);
  return (
    <View style={s.card} accessibilityLiveRegion="polite">
      <View style={s.header}>
        <View style={s.pin}>
          <Icon name="map-pin" size={19} color={colors.white} />
        </View>
        <View style={s.body}>
          <Text style={s.overline}>Ponto escolhido no mapa</Text>
          <Text style={s.address} numberOfLines={2}>
            {loading ? 'Buscando o endereço…' : (address ?? 'Endereço não encontrado aqui')}
          </Text>
          <AppText variant="small" tone="muted">
            Endereço aproximado do ponto tocado.
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar ponto escolhido"
          style={s.close}
          onPress={onClose}
        >
          <Icon name="x" size={18} color={colors.muted} />
        </Pressable>
      </View>
      <View style={s.actions}>
        <View style={s.action}>
          <Button label="Ir para cá" icon="navigation" onPress={onGo} />
        </View>
        <View style={s.action}>
          <Button label="Sair daqui" icon="log-out" variant="secondary" onPress={onStartHere} />
        </View>
      </View>
    </View>
  );
}
