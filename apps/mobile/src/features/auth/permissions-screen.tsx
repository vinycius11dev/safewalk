import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorNotice,
  Icon,
  useUiStyles,
} from '@/components/ui/primitives';
import { useAuth } from './auth-provider';
import { useGeoLocation } from '@/features/location/location-provider';
import { useMapConsent } from '@/features/maps/use-map-data';

export function PermissionsScreen() {
  const gps = useGeoLocation();
  const consent = useMapConsent();
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const [denied, setDenied] = useState(false);
  const ui = useUiStyles();
  const { session } = useAuth();
  async function requestLocation() {
    setPending(true);
    setError(null);
    try {
      await gps.start();
      setDenied(false);
    } catch (failure) {
      setDenied(true);
      setError(
        failure instanceof Error
          ? failure
          : new Error('Não foi possível solicitar a localização neste dispositivo.'),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Protected>
      <Screen title="Permissões">
        <View style={ui.stack}>
          <AppText variant="title">Para proteger você no caminho</AppText>
          <AppText tone="muted">
            O SafeWalk pede acesso quando você precisa. Você pode mudar isso depois nos ajustes do
            celular. Compartilhar um trajeto é sempre uma escolha sua.
          </AppText>
          <Card>
            <Icon name="map-pin" />
            <AppText variant="subtitle">Localização durante o uso</AppText>
            <AppText tone="muted">
              Para encontrar o ponto de partida e acompanhar uma caminhada. O acesso em segundo
              plano será solicitado ao ativar esse recurso.
            </AppText>
            <Button
              label={
                gps.enabled
                  ? 'Desativar localização'
                  : consent.data?.enabled
                    ? 'Permitir localização'
                    : 'Revisar serviços do mapa'
              }
              loading={pending}
              onPress={() => {
                if (!consent.data?.enabled) router.push('/servicos-mapa');
                else if (gps.enabled) gps.stop();
                else void requestLocation();
              }}
            />
          </Card>
          {denied && (
            <Button
              label="Ver opções com permissão negada"
              variant="secondary"
              onPress={() => router.push('/permissao-negada')}
            />
          )}
          <Card>
            <Icon name="bell" />
            <AppText variant="subtitle">Notificações</AppText>
            <AppText tone="muted">
              Para avisos de riscos e pedidos de SOS. Nesta versão, os alertas são apresentados
              dentro do aplicativo.
            </AppText>
            <Badge label="Push ainda não integrado" />
          </Card>
          <Card>
            <Icon name="activity" />
            <AppText variant="subtitle">Movimento e sensores</AppText>
            <AppText tone="muted">
              A detecção de queda, corrida e movimento brusco depende da integração com sensores e
              de validação em aparelho. As situações atuais são simuladas.
            </AppText>
            <Badge label="Sensores ainda não integrados" />
          </Card>
          <ErrorNotice error={error} />
          <Button
            label="Continuar"
            onPress={() => router.replace(session?.user.hasPin ? '/inicio' : '/pin')}
          />
          <AppText variant="small" tone="muted">
            Você pode escolher a origem manualmente. O GPS só começa pelo botão de permissão e as
            posições só são enviadas ao SafeWalk durante um trajeto real ativo.
          </AppText>
        </View>
      </Screen>
    </Protected>
  );
}
