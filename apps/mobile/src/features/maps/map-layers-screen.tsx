import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { UrbanLayerType } from '@safewalk/contracts';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Button, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { layerLabels } from './map-data';
import { useMapLayers } from './use-map-journey';
import { createMapsStyles } from './maps.styles';
export function MapLayersScreen() {
  const { layers, toggle } = useMapLayers();
  const { colors } = useTheme();
  const s = useMemo(() => createMapsStyles(colors), [colors]);
  return (
    <Protected>
      <Screen title="Camadas do mapa">
        <AppText tone="muted">
          Escolha o que quer consultar. Fontes antigas, históricas e indisponíveis são
          identificadas; ausência de dados não significa caminho seguro.
        </AppText>
        {(Object.entries(layerLabels) as [UrbanLayerType, string][]).map(([type, label]) => (
          <Pressable
            key={type}
            style={s.choice}
            accessibilityRole="checkbox"
            accessibilityLabel={
              type === 'flood_susceptibility'
                ? `${label}. Ao ativar, a área aproximada do mapa será enviada ao SGB e a resposta será armazenada em cache; cópias antigas podem ser mantidas.`
                : label
            }
            accessibilityState={{ checked: layers.includes(type) }}
            aria-checked={layers.includes(type)}
            onPress={() => toggle(type)}
          >
            <Icon
              name={layers.includes(type) ? 'check-square' : 'square'}
              color={colors.primaryText}
            />
            <View style={s.grow}>
              <AppText>{label}</AppText>
              {type === 'flood_susceptibility' && (
                <AppText variant="small" tone="muted">
                  Ao ativar, enviamos a área aproximada do mapa ao SGB. O cache vale sete dias;
                  cópias antigas podem ser mantidas. É uma carta histórica, não alerta ao vivo.
                </AppText>
              )}
            </View>
          </Pressable>
        ))}
        <Button label="Ver mapa" onPress={() => router.back()} />
        <Button
          label="Fontes e atualização dos dados"
          variant="secondary"
          onPress={() => router.push('/fontes-dados')}
        />
      </Screen>
    </Protected>
  );
}
