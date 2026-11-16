import { useState } from 'react';
import { ActivityIndicator, Linking } from 'react-native';
import { router } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice } from '@/components/ui/primitives';
import { useUrbanSources } from './use-map-data';
import { readableDate, readableObservation } from './map-data';
const statusLabels = {
  available: 'Dados disponíveis',
  stale: 'Última cópia · desatualizada',
  unavailable: 'Fonte indisponível',
  not_configured: 'Importação pendente',
};
export function SourcesScreen() {
  const sources = useUrbanSources();
  const [linkError, setLinkError] = useState<Error | null>(null);
  return (
    <Protected>
      <Screen title="Fontes e atualização">
        <AppText tone="muted">
          Dados públicos mantêm origem, data e limitações. Uma consulta recente pode conter um
          levantamento antigo.
        </AppText>
        <Button
          label="Privacidade dos serviços do mapa"
          variant="secondary"
          onPress={() => router.push('/servicos-mapa')}
        />
        {sources.isPending && <ActivityIndicator />}
        <ErrorNotice error={sources.error ?? linkError} />
        {sources.isError && (
          <Button
            label="Tentar novamente"
            onPress={() => {
              void sources.refetch();
            }}
          />
        )}
        {sources.data?.sources.map((source) => (
          <Card key={source.id}>
            <AppText variant="heading">{source.name}</AppText>
            <Badge
              label={
                source.id === 'sgb-flood-susceptibility' && source.status === 'not_configured'
                  ? 'Ainda não consultada'
                  : statusLabels[source.status]
              }
              tone={source.status === 'available' ? 'neutral' : 'warning'}
            />
            <AppText>{source.message}</AppText>
            <AppText variant="small" tone="muted">
              Data da base:{' '}
              {source.id === 'sp156'
                ? readableDate(source.asOf)
                : readableObservation(source.asOf, source.id)}
              {'\n'}Última consulta: {readableDate(source.fetchedAt)}
              {'\n'}
              {source.featureCount} registros na última consulta/importação
            </AppText>
            <AppText variant="small">{source.coverage}</AppText>
            <AppText variant="small" tone="muted">
              {source.attribution}
              {'\n'}Licença: {source.license}
            </AppText>
            <Button
              label={`Abrir fonte ${source.name}`}
              variant="ghost"
              onPress={() => {
                void Linking.openURL(source.sourceUrl).catch(() =>
                  setLinkError(new Error('Não foi possível abrir a fonte. Tente novamente.')),
                );
              }}
            />
          </Card>
        ))}
      </Screen>
    </Protected>
  );
}
