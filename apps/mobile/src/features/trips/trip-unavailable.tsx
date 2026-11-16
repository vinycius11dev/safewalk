import { router } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { AppText, Button, ErrorNotice, Icon } from '@/components/ui/primitives';

export function TripUnavailable({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Screen title="Trajeto indisponível">
      <Icon name="map" size={38} />
      <AppText variant="heading">Não foi possível carregar este trajeto.</AppText>
      <ErrorNotice error={error} />
      <Button label="Tentar novamente" onPress={retry} />
      <Button
        label="Voltar ao mapa"
        variant="secondary"
        onPress={() => router.replace('/inicio')}
      />
    </Screen>
  );
}
