import { durationLabel } from '@/lib/duration';
import { routeModeName } from '@/features/maps/route-context-summary';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { useContacts } from '@/features/contacts/use-contacts';
import { useAuth } from '@/features/auth/auth-provider';
import { useTheme } from '@/theme/theme-provider';
import { countLabel } from '@/lib/count-label';
import { createCompanionStyles } from './route-contacts.styles';
import { useMapJourney } from '@/features/maps/use-map-journey';

export function RouteContactsScreen() {
  const {
    destino = 'Casa',
    rota = 'safer',
    contatos,
  } = useLocalSearchParams<{ destino?: string; rota?: string; contatos?: string }>();
  const contacts = useContacts();
  const { session } = useAuth();
  const isDemoAccount = session?.user.demo === true;
  const { journey } = useMapJourney();
  const isRealJourney = Boolean(journey.destination || journey.selectedRoute);
  const route = journey.selectedRoute;
  const destination = isRealJourney ? journey.destinationLabel || destino : destino;
  const { colors } = useTheme();
  const s = useMemo(() => createCompanionStyles(colors), [colors]);
  const ui = useUiStyles();
  const [selection, setSelection] = useState<string[] | null>(
    contatos === undefined ? null : contatos.split(',').filter(Boolean),
  );
  const accepted = contacts.data?.filter((contact) => contact.accepted) ?? [];
  const selected = (
    selection ?? accepted.filter((contact) => contact.defaultAccompany).map((contact) => contact.id)
  ).filter((id) => accepted.some((contact) => contact.id === id));
  return (
    <Protected>
      <Screen title="Quem acompanha esta rota">
        {isRealJourney ? (
          <Card>
            <AppText variant="heading">
              {journey.originLabel} → {destination}
            </AppText>
            <AppText tone="muted">
              {route
                ? `${routeModeName(route)} · ${durationLabel(route.durationMinutes)} · ${(route.distanceMeters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km estimados`
                : 'Rota de pedestres · cálculo pendente'}
            </AppText>
          </Card>
        ) : isDemoAccount ? (
          <Card>
            <AppText variant="heading">FIAP Paulista · demonstração → {destination}</AppText>
            <AppText tone="muted">
              {rota === 'faster'
                ? 'Demonstração · rota mais rápida · 14 min'
                : 'Demonstração · rota mais segura · 17 min'}
            </AppText>
          </Card>
        ) : (
          <Card>
            <AppText variant="heading">Escolha o destino</AppText>
            <AppText tone="muted">
              Busque o destino no mapa para ver a rota e o tempo estimado de caminhada.
            </AppText>
          </Card>
        )}
        {contacts.isPending && <ActivityIndicator color={colors.primary} />}
        <ErrorNotice error={contacts.error} />
        {contacts.error && (
          <Button
            label="Tentar novamente"
            variant="secondary"
            onPress={() => {
              void contacts.refetch();
            }}
          />
        )}
        {contacts.data?.map((contact, index) => (
          <Pressable
            key={contact.id}
            accessibilityRole="checkbox"
            accessibilityLabel={`${contact.name}${contact.accepted ? '' : ', convite pendente'}`}
            accessibilityState={{
              checked: selected.includes(contact.id),
              disabled: !contact.accepted,
            }}
            disabled={!contact.accepted}
            style={[s.contact, !contact.accepted && s.pending]}
            onPress={() =>
              setSelection(
                selected.includes(contact.id)
                  ? selected.filter((id) => id !== contact.id)
                  : [...selected, contact.id],
              )
            }
          >
            <View style={[s.avatar, index % 2 === 1 && s.avatarSecond]}>
              <AppText style={s.avatarText}>{contact.name.charAt(0)}</AppText>
            </View>
            <View style={ui.grow}>
              <AppText variant="subtitle">{contact.name}</AppText>
              <AppText variant="small" tone="muted">
                {contact.accepted
                  ? 'Acompanha pelo link durante esta rota'
                  : 'Precisa aceitar o convite primeiro'}
              </AppText>
            </View>
            <Icon
              name={selected.includes(contact.id) ? 'check-square' : 'square'}
              color={contact.accepted ? colors.primaryText : colors.muted}
            />
          </Pressable>
        ))}
        {!contacts.isPending && accepted.length === 0 && (
          <Card>
            <Icon name="users" size={32} />
            <AppText variant="heading">Sua rede de apoio começa aqui.</AppText>
            <AppText tone="muted">
              Adicione um contato e envie o convite antes de compartilhar. Você também pode caminhar
              sem acompanhamento.
            </AppText>
            <Button label="Adicionar contato" onPress={() => router.push('/contatos')} />
          </Card>
        )}
        <View style={s.notice}>
          <Icon name="info" color={colors.primaryText} />
          <AppText variant="small" tone="muted" style={ui.grow}>
            A seleção vale só para esta rota e apenas os contatos selecionados recebem acesso pelo
            link. Por e-mail, o link chega automaticamente a quem autorizou esse envio. Por WhatsApp
            ou SMS, o app abre a conversa com a mensagem pronta e você toca em enviar.
          </AppText>
        </View>
        <Badge
          label={countLabel(selected.length, 'contato selecionado', 'contatos selecionados')}
          tone={selected.length ? 'success' : 'warning'}
        />
        <Button
          label={
            selected.length
              ? `Salvar · ${countLabel(selected.length, 'contato', 'contatos')}`
              : 'Continuar sem acompanhamento'
          }
          disabled={contacts.isPending || Boolean(contacts.error)}
          onPress={() =>
            router.replace({
              pathname: '/rotas',
              params: {
                destino: destination,
                rota: isRealJourney ? 'faster' : rota,
                contatos: selected.join(','),
              },
            })
          }
        />
      </Screen>
    </Protected>
  );
}
