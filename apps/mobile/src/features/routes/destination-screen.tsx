import { router } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import { LocationPicker } from '@/components/map/location-picker';
export function DestinationScreen() {
  return (
    <Protected>
      <Screen title="Escolher no mapa" scroll={false}>
        <LocationPicker
          initialAddress="R. Frei Caneca · Consolação"
          initialLocation={{ latitude: -23.5558, longitude: -46.6524 }}
          confirmLabel="Confirmar destino"
          onConfirm={(selection) =>
            router.replace({ pathname: '/rotas', params: { destino: selection.address } })
          }
        />
      </Screen>
    </Protected>
  );
}
