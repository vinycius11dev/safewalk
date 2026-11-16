import { router } from 'expo-router';
import { AppText, Button, ErrorNotice } from '@/components/ui/primitives';
import { useSetMapConsent } from './use-map-data';

type MapConsentPromptProps = {
  title?: string;
  description?: string;
  /** Rótulo do botão principal; diz o que acontece ao tocar. */
  actionLabel?: string;
};

/**
 * Ativa os serviços do mapa com um toque, no próprio lugar onde a pessoa precisa deles.
 * O texto resume o que é enviado; a página completa (/servicos-mapa) continua a um toque.
 */
export function MapConsentPrompt({
  title = 'Ative o mapa para continuar',
  description = 'Para buscar endereços e calcular a rota, enviamos o termo da busca e os pontos escolhidos aos serviços de mapa (OpenFreeMap, Photon e Valhalla). Seu nome, telefone e e-mail não são enviados, e o GPS só liga quando você pedir.',
  actionLabel = 'Ativar o mapa',
}: MapConsentPromptProps) {
  const setConsent = useSetMapConsent();
  return (
    <>
      <AppText variant="heading">{title}</AppText>
      <AppText tone="muted">{description}</AppText>
      <ErrorNotice error={setConsent.error} />
      <Button
        label={actionLabel}
        icon="map"
        loading={setConsent.isPending}
        onPress={() => setConsent.mutate(true)}
      />
      <Button
        label="Ver o que é enviado"
        variant="ghost"
        onPress={() => router.push('/servicos-mapa')}
      />
    </>
  );
}
