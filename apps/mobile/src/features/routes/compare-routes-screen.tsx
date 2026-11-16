import { durationLabel } from '@/lib/duration';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { RouteKind } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, ErrorNotice, Icon, useUiStyles } from '@/components/ui/primitives';
import { MapScene } from '@/components/map/map-scene';
import { useTheme } from '@/theme/theme-provider';
import { countLabel } from '@/lib/count-label';
import { useAuth } from '@/features/auth/auth-provider';
import { useContacts } from '@/features/contacts/use-contacts';
import { useStartTrip, useTrips } from '@/features/trips/use-trips';
import { useAdultCompanion } from '@/features/trips/use-adult-companion';
import { AdultCompanionCheck } from '@/features/trips/adult-companion-check';
import { getRouteOptions } from './routes.service';
import { createRouteStyles } from './compare-routes.styles';

export function CompareRoutesScreen() {
  const { destino, rota, routeKind, contatos, semContatos } = useLocalSearchParams<{
    destino?: string;
    rota?: string;
    routeKind?: string;
    contatos?: string;
    semContatos?: string;
  }>();
  const destination = destino ?? 'Casa';
  const [selected, setSelected] = useState<RouteKind>(
    (rota ?? routeKind) === 'faster' ? 'faster' : 'safer',
  );
  const { colors } = useTheme();
  const s = useMemo(() => createRouteStyles(colors), [colors]);
  const ui = useUiStyles();
  const { session } = useAuth();
  const routes = useQuery({
    queryKey: ['routes', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => getRouteOptions(session?.token ?? '', signal),
  });
  const contacts = useContacts();
  const trips = useTrips();
  const start = useStartTrip();
  const adult = useAdultCompanion();
  const accepted = contacts.data?.filter((contact) => contact.accepted) ?? [];
  const contactIds = (
    contatos === undefined
      ? accepted.filter((contact) => contact.defaultAccompany).map((contact) => contact.id)
      : contatos.split(',')
  ).filter((id) => accepted.some((contact) => contact.id === id));
  const activeTrip = trips.data?.find((trip) => !['arrived', 'cancelled'].includes(trip.status));
  function begin() {
    if (activeTrip) {
      router.push({ pathname: '/trajeto/[id]', params: { id: activeTrip.id } });
      return;
    }
    if (!session?.user.hasPin) {
      router.push('/pin');
      return;
    }
    if (contactIds.length === 0 && contatos === undefined && semContatos !== '1') {
      router.push({
        pathname: '/sem-contatos',
        params: { destino: destination, routeKind: selected },
      });
      return;
    }
    start.mutate(
      { routeKind: selected, destination, contactIds, ...adult.startInput },
      {
        onSuccess: ({ trip }) =>
          router.replace({ pathname: '/trajeto/[id]', params: { id: trip.id } }),
      },
    );
  }
  return (
    <Protected>
      <Screen scroll={false}>
        <MapScene variant="routes" />
        <View style={s.originPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
          >
            <Icon name="chevron-left" />
          </Pressable>
          <View style={s.originFields}>
            <View style={s.address}>
              <Icon name="circle" size={12} color={colors.primaryText} />
              <AppText style={s.addressText}>Sua localização · FIAP Paulista</AppText>
            </View>
            <View style={s.address}>
              <Icon name="map-pin" size={14} color={colors.danger} />
              <AppText style={s.addressText}>{destination} · R. Frei Caneca</AppText>
            </View>
          </View>
        </View>
        <View style={s.demoMap}>
          <Badge label="Comparação ilustrativa · dados de demonstração" />
        </View>
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          <View style={s.handle} />
          {routes.isPending && <ActivityIndicator color={colors.primary} />}
          <ErrorNotice error={routes.error} />
          {routes.error && (
            <Button
              label="Recarregar rotas"
              variant="secondary"
              onPress={() => {
                void routes.refetch();
              }}
            />
          )}
          {routes.data?.map((route) => (
            <Pressable
              key={route.kind}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === route.kind }}
              aria-checked={selected === route.kind}
              accessibilityLabel={
                route.kind === 'safer'
                  ? 'Selecionar rota mais segura'
                  : 'Selecionar rota mais rápida'
              }
              style={[s.routeCard, selected === route.kind && s.selected]}
              onPress={() => setSelected(route.kind)}
            >
              <View style={ui.between}>
                <View style={ui.row}>
                  <AppText style={s.time}>{durationLabel(route.durationMinutes)}</AppText>
                  <AppText style={s.routeMeta}>
                    {(route.distanceMeters / 1000).toLocaleString('pt-BR')} km
                  </AppText>
                </View>
                <Badge
                  label={`Risco ${route.riskLabel}`}
                  tone={route.kind === 'safer' ? 'success' : 'danger'}
                />
              </View>
              <AppText style={s.description}>
                <AppText style={s.bold}>
                  {route.kind === 'safer' ? 'Mais segura' : 'Mais rápida'}
                </AppText>{' '}
                · {route.description}
              </AppText>
            </Pressable>
          ))}
          <View style={s.contacts}>
            <View style={s.avatarGroup}>
              {accepted
                .filter((contact) => contactIds.includes(contact.id))
                .slice(0, 2)
                .map((contact, index) => (
                  <View key={contact.id} style={[s.avatar, index === 1 && s.avatarSecond]}>
                    <AppText style={s.avatarText}>{contact.name.charAt(0)}</AppText>
                  </View>
                ))}
            </View>
            <AppText variant="label" style={ui.grow}>
              {contactIds.length
                ? countLabel(contactIds.length, 'contato acompanha', 'contatos acompanham')
                : 'Sem contatos neste trajeto'}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/quem-acompanha',
                  params: { destino: destination, rota: selected, contatos: contactIds.join(',') },
                })
              }
            >
              <AppText tone="primary" variant="label">
                Alterar
              </AppText>
            </Pressable>
          </View>
          {!activeTrip && (
            <AdultCompanionCheck
              required={adult.required}
              confirmed={adult.confirmed}
              onToggle={adult.toggle}
            />
          )}
          <ErrorNotice error={start.error ?? contacts.error ?? trips.error} />
          <Button
            label={
              activeTrip
                ? 'Retomar trajeto'
                : selected === 'safer'
                  ? 'Iniciar rota mais segura'
                  : 'Iniciar rota mais rápida'
            }
            loading={start.isPending}
            disabled={
              !routes.data?.length ||
              (!activeTrip && adult.blocked) ||
              contacts.isPending ||
              trips.isPending ||
              Boolean(contacts.error) ||
              Boolean(trips.error)
            }
            onPress={begin}
          />
        </ScrollView>
      </Screen>
    </Protected>
  );
}
