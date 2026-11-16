import { useState } from 'react';
import { router } from 'expo-router';
import { contactSchema } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useContacts, useCreateContact } from './use-contacts';

export function AddContactScreen({ onboarding = false }: { onboarding?: boolean }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const create = useCreateContact();
  const contacts = useContacts();
  const limitReached = (contacts.data?.length ?? 0) >= 5;
  function submit() {
    const parsed = contactSchema.safeParse({
      name,
      phone,
      email: email.trim() || undefined,
      emailTripAlerts: false,
      relationship: relationship || 'Contato de segurança',
    });
    if (!parsed.success) {
      setError(new Error('Confira o nome, o celular com DDD e o e-mail informado.'));
      return;
    }
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: (contact) =>
        router.replace({
          pathname: '/contato/[id]',
          params: { id: contact.id, onboarding: onboarding ? '1' : '0' },
        }),
    });
  }
  return (
    <Protected>
      <Screen title={onboarding ? 'Seu primeiro contato' : 'Adicionar contato'}>
        <Icon name="users" size={38} />
        <AppText variant="title">
          {onboarding ? 'Quem cuida de você?' : 'Uma pessoa de confiança.'}
        </AppText>
        <AppText tone="muted">
          Essa pessoa poderá acompanhar os trajetos que você escolher compartilhar e ajudar se
          houver um alerta.
        </AppText>
        <Badge label={`${contacts.data?.length ?? '—'} de 5 contatos`} />
        {limitReached && (
          <Card>
            <AppText tone="muted">
              Você já tem 5 contatos. Remova um contato antes de adicionar outro.
            </AppText>
            <Button label="Ver meus contatos" onPress={() => router.replace('/contatos')} />
          </Card>
        )}
        <Field
          label="Nome do contato"
          value={name}
          onChangeText={setName}
          placeholder="Ex.: Mãe"
          autoComplete="name"
        />
        <Field
          label="Celular com DDD"
          value={phone}
          onChangeText={setPhone}
          placeholder="+55 11 99999-9999"
          keyboardType="phone-pad"
          autoComplete="tel"
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
        <Field
          label="Relação com você"
          value={relationship}
          onChangeText={setRelationship}
          placeholder="Ex.: Família, amizade"
        />
        <Card>
          <Badge label="Convite e escolha do contato" />
          <AppText variant="small" tone="muted">
            Cadastre o e-mail para poder enviar o convite por e-mail. A pessoa decide no convite se
            quer receber os links quando você iniciar um trajeto; essa opção começa desligada e só
            ela pode ativá-la.
          </AppText>
          <Badge label="A pessoa autoriza no convite" tone="warning" />
          <AppText variant="small" tone="muted">
            O envio de links por e-mail começa desligado. Só o próprio contato pode autorizar o
            recebimento quando aceitar o convite.
          </AppText>
        </Card>
        <ErrorNotice error={error ?? create.error} />
        <Button
          label="Salvar contato e continuar"
          loading={create.isPending}
          disabled={!name.trim() || !phone.trim() || limitReached}
          onPress={submit}
        />
        {onboarding && (
          <Button
            label="Adicionar depois"
            variant="ghost"
            onPress={() => router.replace('/inicio')}
          />
        )}
      </Screen>
    </Protected>
  );
}

export function FirstContactScreen() {
  return <AddContactScreen onboarding />;
}
