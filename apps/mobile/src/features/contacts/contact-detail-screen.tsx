import { useState } from 'react';
import { ActivityIndicator, Share, Switch, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { contactUpdateSchema, type Contact } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import {
  AppText,
  Badge,
  Button,
  Card,
  ErrorNotice,
  Field,
  Icon,
  useUiStyles,
} from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';
import { useContacts, useDeleteContact } from './use-contacts';
import { contactsService } from './contacts.service';
import { useTrips } from '@/features/trips/use-trips';

function ContactDetail({ contact, onboarding }: { contact: Contact; onboarding: boolean }) {
  const { session } = useAuth();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [email, setEmail] = useState(contact.email ?? '');
  const [relationship, setRelationship] = useState(contact.relationship);
  const [emailTripAlerts, setEmailTripAlerts] = useState(contact.emailTripAlerts);
  const [defaultAccompany, setDefaultAccompany] = useState(contact.defaultAccompany);
  const [pin, setPin] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const remove = useDeleteContact();
  const ui = useUiStyles();
  const trips = useTrips();
  const accompanied = trips.data?.filter((trip) => trip.contactIds.includes(contact.id)) ?? [];
  const invite = useMutation({
    mutationFn: () => contactsService.invitation(session?.token ?? '', contact.id),
  });
  const inviteByEmail = useMutation({
    mutationFn: () => contactsService.invitationEmail(session?.token ?? '', contact.id),
    onSuccess: ({ status }) => {
      setNotice(
        status === 'accepted_by_relay'
          ? 'O servidor de e-mail aceitou o convite. Isso não confirma a entrega na caixa de entrada.'
          : status === 'not_configured'
            ? 'O envio de e-mail não está configurado. Crie um link para compartilhar manualmente.'
            : 'O servidor de e-mail não aceitou o convite. Você ainda pode compartilhar um link manualmente.',
      );
    },
  });
  const update = useMutation({
    mutationFn: () =>
      contactsService.update(
        session?.token ?? '',
        contact.id,
        contactUpdateSchema.parse({
          name,
          phone,
          email: email.trim() || undefined,
          emailTripAlerts,
          relationship,
          currentPin: pin,
          defaultAccompany,
        }),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['contacts'] });
      setEditing(false);
      setPin('');
      const identityChanged =
        contact.phone.replace(/\D/g, '') !== phone.replace(/\D/g, '') ||
        (contact.email ?? '') !== (email.trim() || '');
      if (identityChanged) setEmailTripAlerts(false);
      setNotice(
        identityChanged
          ? 'Contato atualizado. A pessoa precisa aceitar um novo convite; o envio automático por e-mail foi desligado.'
          : 'Contato atualizado.',
      );
    },
  });
  async function copy() {
    try {
      if (invite.data) {
        await Clipboard.setStringAsync(invite.data.url);
        setNotice('Convite copiado.');
      }
    } catch {
      setError(new Error('Não foi possível copiar o convite.'));
    }
  }
  return (
    <Screen title="Contato de segurança">
      <Icon name="user-check" size={38} />
      <AppText variant="title">{contact.name}</AppText>
      <AppText tone="muted">
        {contact.relationship} · {contact.phone}
      </AppText>
      <AppText tone="muted">{contact.email ?? 'Nenhum e-mail cadastrado'}</AppText>
      <Badge
        label={contact.accepted ? 'Convite aceito' : 'Aguardando consentimento'}
        tone={contact.accepted ? 'success' : 'warning'}
      />
      <Card>
        <AppText variant="subtitle">
          {contact.accepted ? 'Pronto para acompanhar' : 'Envie o convite'}
        </AppText>
        <AppText tone="muted">
          {contact.accepted
            ? 'Você poderá selecionar este contato antes de começar um trajeto. O acesso termina junto com a caminhada.'
            : 'O contato precisa aceitar para receber links dos seus trajetos. Ele não precisa instalar o aplicativo.'}
        </AppText>
      </Card>
      <Card>
        <AppText variant="subtitle">Links de trajeto por e-mail</AppText>
        <Badge
          label={
            contact.emailTripAlerts ? 'Autorizado pela pessoa' : 'A pessoa autoriza no convite'
          }
          tone={contact.emailTripAlerts ? 'success' : 'warning'}
        />
        <AppText variant="small" tone="muted">
          {contact.emailTripAlerts
            ? 'Quando você selecionar este contato para um trajeto, o SafeWalk enviará o link para o e-mail cadastrado. O provedor pode aceitar a mensagem sem confirmar a entrega na caixa de entrada.'
            : !contact.email
              ? 'Cadastre um e-mail e envie um convite para a pessoa decidir.'
              : contact.accepted
                ? 'A pessoa ainda não autorizou o envio automático. Só ela pode ativar essa opção no convite.'
                : 'Depois de aceitar o convite, a pessoa poderá escolher se quer receber esses links.'}
        </AppText>
      </Card>
      {contact.emailTripAlerts && !editing && (
        <Button
          label="Desativar envio por e-mail"
          variant="secondary"
          onPress={() => {
            setEmailTripAlerts(false);
            setEditing(true);
            setRemoving(false);
            setPin('');
          }}
        />
      )}
      <Card>
        <View style={ui.between}>
          <View style={ui.grow}>
            <AppText variant="subtitle">Acompanha minhas rotas</AppText>
            <AppText variant="small" tone="muted">
              Pré-selecionado nos próximos trajetos, depois de aceitar o convite.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Acompanha minhas rotas por padrão"
            value={defaultAccompany}
            onValueChange={(value) => {
              setDefaultAccompany(value);
              setEditing(true);
              setRemoving(false);
              setPin('');
            }}
          />
        </View>
        <AppText variant="small" tone="muted">
          Quando escolhido para acompanhar, vê o trajeto e o SOS pelo link. Com o e-mail autorizado,
          o link chega automaticamente; por WhatsApp ou SMS, o app abre a conversa com a mensagem
          pronta e você toca em enviar.
        </AppText>
      </Card>
      <Card>
        <AppText variant="subtitle">Atividade recente</AppText>
        <ErrorNotice error={trips.error} />
        <AppText variant="small" tone="muted">
          {accompanied.length} trajetos recentes com este contato selecionado.
        </AppText>
        {accompanied[0] && (
          <AppText variant="small" tone="muted">
            Último:{' '}
            {new Date(accompanied[0].startedAt).toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </AppText>
        )}
      </Card>
      {Boolean(notice) && (
        <AppText accessibilityRole="status" tone="success">
          {notice}
        </AppText>
      )}
      <ErrorNotice
        error={error ?? invite.error ?? inviteByEmail.error ?? update.error ?? remove.error}
      />
      {(!contact.accepted || (contact.email && !contact.emailTripAlerts)) && (
        <Button
          label={contact.accepted ? 'Criar novo convite de autorização' : 'Criar convite'}
          icon="link"
          loading={invite.isPending}
          onPress={() => invite.mutate()}
        />
      )}
      {contact.email && (!contact.accepted || !contact.emailTripAlerts) && (
        <Button
          label={
            contact.accepted ? 'Solicitar autorização por e-mail' : 'Enviar convite por e-mail'
          }
          variant="secondary"
          icon="mail"
          loading={inviteByEmail.isPending}
          onPress={() => inviteByEmail.mutate()}
        />
      )}
      {invite.data && (
        <Card>
          <AppText variant="subtitle">Convite pronto</AppText>
          <Button
            label="Copiar convite"
            icon="copy"
            onPress={() => {
              void copy();
            }}
          />
          <Button
            label="Compartilhar convite"
            variant="secondary"
            icon="share-2"
            onPress={() => {
              void Share.share({
                message: `Aceite meu convite no SafeWalk: ${invite.data.url}`,
              }).catch(() => setError(new Error('Não foi possível compartilhar.')));
            }}
          />
          <Link
            href={{
              pathname: '/convite/[token]',
              params: { token: new URL(invite.data.url).pathname.split('/').at(-1) ?? '' },
            }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <AppText tone="primary">Abrir convite</AppText>
          </Link>
        </Card>
      )}
      {editing ? (
        <Card>
          <AppText variant="heading">Editar contato</AppText>
          <Field label="Nome" value={name} onChangeText={setName} />
          <Field
            label="Celular com DDD"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <Field
            label="E-mail (opcional)"
            value={email}
            onChangeText={setEmail}
            placeholder="nome@exemplo.com"
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field label="Relação" value={relationship} onChangeText={setRelationship} />
          <Field
            label="Seu PIN atual"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            label="Salvar alterações"
            disabled={pin.length < 4}
            loading={update.isPending}
            onPress={() => update.mutate()}
          />
          <Button
            label="Cancelar edição"
            variant="ghost"
            onPress={() => {
              setEditing(false);
              setPin('');
              setName(contact.name);
              setPhone(contact.phone);
              setEmail(contact.email ?? '');
              setRelationship(contact.relationship);
              setEmailTripAlerts(contact.emailTripAlerts);
              setDefaultAccompany(contact.defaultAccompany);
            }}
          />
        </Card>
      ) : (
        <Button
          label="Editar contato"
          variant="secondary"
          icon="edit-2"
          onPress={() => {
            setEditing(true);
            setRemoving(false);
            setPin('');
          }}
        />
      )}
      {removing ? (
        <Card>
          <AppText variant="heading">Remover {contact.name}?</AppText>
          <AppText tone="muted">
            Este contato deixará de receber novos links. Encerre qualquer trajeto acompanhado por
            ele antes de remover.
          </AppText>
          <Field
            label="Confirme seu PIN"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button
            label="Confirmar remoção"
            variant="danger"
            disabled={pin.length < 4}
            loading={remove.isPending}
            onPress={() =>
              remove.mutate(
                { id: contact.id, pin },
                { onSuccess: () => router.replace('/contatos') },
              )
            }
          />
          <Button
            label="Manter contato"
            variant="ghost"
            onPress={() => {
              setRemoving(false);
              setPin('');
            }}
          />
        </Card>
      ) : (
        !editing && (
          <Button
            label="Remover contato"
            variant="ghost"
            onPress={() => {
              setRemoving(true);
              setPin('');
            }}
          />
        )
      )}
      {onboarding && (
        <Button label="Concluir e abrir mapa" onPress={() => router.replace('/inicio')} />
      )}
    </Screen>
  );
}
export function ContactDetailScreen() {
  const { id, onboarding } = useLocalSearchParams<{ id: string; onboarding?: string }>();
  const contacts = useContacts();
  const contact = contacts.data?.find((item) => item.id === id);
  return (
    <Protected>
      {contacts.isPending ? (
        <Screen title="Contato">
          <ActivityIndicator />
        </Screen>
      ) : contact ? (
        <ContactDetail key={contact.id} contact={contact} onboarding={onboarding === '1'} />
      ) : (
        <Screen title="Contato">
          <ErrorNotice error={contacts.error} />
          <AppText>Não foi possível encontrar esse contato.</AppText>
          {contacts.isError && (
            <Button
              label="Tentar novamente"
              onPress={() => {
                void contacts.refetch();
              }}
            />
          )}
          <Button label="Voltar aos contatos" onPress={() => router.replace('/contatos')} />
        </Screen>
      )}
    </Protected>
  );
}
