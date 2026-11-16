import { durationLabel } from '@/lib/duration';
import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, Icon, useUiStyles } from '@/components/ui/primitives';
import { useMapJourney } from '@/features/maps/use-map-journey';
import { LocationStateScreen } from '@/features/system/location-state-screen';
import { useTheme } from '@/theme/theme-provider';
import { createCompanionStyles } from './route-contacts.styles';

export function NoContactsScreen() {
  const params = useLocalSearchParams<{ destino?: string; routeKind?: string; rota?: string }>();
  const { journey } = useMapJourney();
  const { colors } = useTheme();
  const styles = useMemo(() => createCompanionStyles(colors), [colors]);
  const ui = useUiStyles();
  if (!journey.destination && !journey.selectedRoute)
    return <LocationStateScreen kind="contacts" />;
  const route = journey.selectedRoute;
  const destination = journey.destinationLabel || params.destino || 'Destino escolhido';
  return (
    <Protected>
      <Screen title="Contatos de segurança">
        <Icon name="users" size={38} color={colors.primaryText} />
        <AppText variant="title">Ninguém vai acompanhar esta rota</AppText>
        <Card>
          <AppText variant="subtitle">
            {journey.originLabel} → {destination}
          </AppText>
          <AppText tone="muted">
            {route
              ? `${durationLabel(route.durationMinutes)} · ${(route.distanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km estimados`
              : 'Rota de pedestres · cálculo pendente'}
          </AppText>
          <Badge label="Risco e acessibilidade não avaliados" />
        </Card>
        <AppText tone="muted">
          Sem um contato selecionado com convite aceito, ninguém recebe acesso para acompanhar esta
          caminhada. O SafeWalk não aciona uma central de emergência automaticamente.
        </AppText>
        <View style={styles.notice}>
          <Icon name="info" color={colors.primaryText} />
          <AppText variant="small" style={ui.grow}>
            Você pode adicionar uma pessoa de confiança ou continuar sem acompanhamento.
          </AppText>
        </View>
        <Button
          label="Escolher contatos"
          icon="users"
          onPress={() =>
            router.replace({
              pathname: '/quem-acompanha',
              params: { destino: destination, rota: 'faster' },
            })
          }
        />
        <Button
          label="Adicionar contato"
          variant="secondary"
          icon="user-plus"
          onPress={() => router.push('/adicionar-contato')}
        />
        <Button
          label="Continuar sem acompanhamento"
          variant="ghost"
          onPress={() =>
            router.replace({
              pathname: '/rotas',
              params: {
                destino: destination,
                rota: 'faster',
                routeKind: 'faster',
                contatos: '',
                semContatos: '1',
              },
            })
          }
        />
      </Screen>
    </Protected>
  );
}
