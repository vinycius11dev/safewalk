import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { Coordinates } from '@safewalk/contracts';
import { RealMap } from './real-map';
import { AppText, Badge, Button, Field } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createLocationPickerStyles } from './location-picker.styles';

export function LocationPicker({
  initialAddress,
  initialLocation,
  confirmLabel = 'Confirmar local',
  mapEnabled = false,
  onRequestMap,
  mapRequestPending = false,
  onConfirm,
}: {
  initialAddress: string;
  initialLocation: Coordinates;
  confirmLabel?: string;
  mapEnabled?: boolean;
  onRequestMap?: () => void;
  mapRequestPending?: boolean;
  onConfirm: (selection: { address: string; location: Coordinates }) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createLocationPickerStyles(colors), [colors]);
  const [address, setAddress] = useState(initialAddress);
  const [selection, setSelection] = useState<Coordinates | null>(null);
  return (
    <View style={styles.root}>
      {mapEnabled ? (
        <RealMap
          center={initialLocation}
          selectedPoint={selection}
          controlsTop={128}
          attributionTop={98}
          onMapPress={(point) => {
            setSelection(point);
            setAddress('');
          }}
          accessibilityLabel="Escolha o local do relato no mapa real. Clique ou toque para selecionar. Com teclado, navegue no mapa e pressione Enter para escolher o centro."
        />
      ) : (
        <View style={styles.disabledMap}>
          <AppText variant="small" tone="muted">
            OpenFreeMap receberá requisições da região exibida. A posição do aparelho não é
            solicitada.
          </AppText>
          {onRequestMap && (
            <Button label="Ativar mapa real" loading={mapRequestPending} onPress={onRequestMap} />
          )}
        </View>
      )}
      <View pointerEvents="none" style={styles.hint}>
        <AppText variant="subtitle">
          {mapEnabled ? 'Toque no mapa para selecionar o ponto' : 'Escolha o local do relato'}
        </AppText>
        <Badge
          label={
            selection
              ? 'Ponto escolhido no mapa real'
              : 'Referência inicial · confirme o local do relato'
          }
        />
      </View>
      <View style={styles.panel}>
        <Field
          label="Endereço ou referência do ponto (manual)"
          value={address}
          onChangeText={setAddress}
          maxLength={200}
          placeholder="Informe uma rua, número ou referência"
        />
        <AppText variant="small" tone="muted">
          {selection
            ? `${selection.latitude.toFixed(6)}, ${selection.longitude.toFixed(6)} · coordenadas do ponto escolhido.`
            : 'Nenhum ponto confirmado. A referência inicial do mapa não é sua localização.'}
        </AppText>
        <AppText variant="small" tone="muted">
          O texto do endereço é informado por você. Não há validação automática de que corresponde
          ao ponto.
        </AppText>
        <Button
          label={confirmLabel}
          disabled={!mapEnabled || !selection || address.trim().length < 3}
          onPress={() => {
            if (selection) onConfirm({ address: address.trim(), location: selection });
          }}
        />
      </View>
    </View>
  );
}
