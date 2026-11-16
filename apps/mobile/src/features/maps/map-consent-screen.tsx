import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useMapConsent, useSetMapConsent } from './use-map-data';
import { useGeoLocation } from '@/features/location/location-provider';
import { createMapsStyles } from './maps.styles';
export function MapConsentScreen() {
  const current = useMapConsent();
  const save = useSetMapConsent();
  const gps = useGeoLocation();
  const [accepted, setAccepted] = useState(false);
  const { colors } = useTheme();
  const s = useMemo(() => createMapsStyles(colors), [colors]);
  return (
    <Protected>
      <Screen title="Serviços do mapa">
        <Icon name="map" size={38} color={colors.primaryText} />
        <AppText variant="title">Mapas reais, por sua escolha.</AppText>
        <AppText tone="muted">
          O SafeWalk usa provedores externos para desenhar o mapa, encontrar endereços e calcular
          rotas a pé ou de carro.
        </AppText>
        <Card>
          <AppText variant="subtitle">O que é enviado</AppText>
          <AppText>
            OpenFreeMap recebe pedidos dos trechos visíveis do mapa. Photon recebe os termos de
            busca ou o ponto escolhido. Valhalla recebe as coordenadas de origem e destino.
          </AppText>
          <AppText tone="muted" variant="small">
            Ao usar GPS, esses pedidos podem revelar sua região e seus destinos aos provedores. Os
            serviços comunitários podem registrar consultas e não têm garantia de disponibilidade.
            Não enviamos seu nome, telefone ou token do SafeWalk.
          </AppText>
        </Card>
        <Card>
          <AppText variant="subtitle">Dados urbanos</AppText>
          <AppText>
            Consultamos bases públicas de São Paulo e informações meteorológicas por nossa API. Cada
            camada mostra fonte e data. Um histórico não comprova a condição atual do trecho.
          </AppText>
          <AppText variant="small" tone="muted">
            A camada opcional do SGB consulta cartas de suscetibilidade à inundação. Se você a
            ativar em Camadas do mapa, nossa API envia ao SGB a área aproximada do mapa visível e
            guarda a resposta em cache válido por sete dias; cópias antigas podem ser mantidas. A
            consulta não envia nome ou token.
          </AppText>
        </Card>
        {current.isPending && <ActivityIndicator color={colors.primary} />}
        <ErrorNotice error={current.error ?? save.error} />
        {current.data?.enabled ? (
          <>
            <Badge label="Serviços externos autorizados nesta conta" tone="success" />
            <Button
              label="Continuar para o mapa"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/inicio'))}
            />
            <Button
              label="Desativar serviços externos e GPS"
              variant="secondary"
              loading={save.isPending}
              onPress={() => save.mutate(false, { onSuccess: () => gps.stop() })}
            />
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              aria-checked={accepted}
              style={s.choice}
              onPress={() => setAccepted((value) => !value)}
            >
              <Icon name={accepted ? 'check-square' : 'square'} color={colors.primaryText} />
              <AppText style={s.grow}>
                Entendi quais dados são enviados e quero usar os serviços externos do mapa.
              </AppText>
            </Pressable>
            <Button
              label="Ativar mapas e rotas reais"
              disabled={!accepted || current.isPending}
              loading={save.isPending}
              onPress={() =>
                save.mutate(true, {
                  onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/inicio')),
                })
              }
            />
          </>
        )}
        <AppText variant="small" tone="muted">
          A autorização não inicia o GPS. Você pode definir origem e destino manualmente ou
          solicitar localização por um botão específico.
        </AppText>
      </Screen>
    </Protected>
  );
}
