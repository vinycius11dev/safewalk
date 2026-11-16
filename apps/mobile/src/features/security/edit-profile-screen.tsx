import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { profileUpdateSchema, type User } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';
import { authService } from '@/features/auth/auth.service';

function ProfileForm({ profile }: { profile: User & { phone: string } }) {
  const { session, saveSession } = useAuth();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [credential, setCredential] = useState('');
  const update = useMutation({
    mutationFn: () =>
      authService.updateProfile(
        session?.token ?? '',
        profileUpdateSchema.parse({
          name,
          phone,
          email,
          ...(profile.hasPin ? { currentPin: credential } : { password: credential }),
        }),
      ),
    onSuccess: async (user) => {
      if (session) await saveSession({ ...session, user });
      router.replace('/seguranca');
    },
  });
  return (
    <Screen title="Editar perfil">
      <Icon name="user" size={38} />
      <AppText variant="title">Como seus contatos veem você.</AppText>
      <Field label="Nome" value={name} onChangeText={setName} autoComplete="name" />
      <AppText variant="small" tone="muted">
        É assim que seus contatos te veem nos avisos.
      </AppText>
      <Field
        label="Celular"
        value={phone}
        onChangeText={setPhone}
        autoComplete="tel"
        keyboardType="phone-pad"
        placeholder="+55 11 99999-9999"
      />
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Card>
        <AppText variant="subtitle">Confirme que é você</AppText>
        <AppText variant="small" tone="muted">
          {profile.hasPin
            ? 'Digite seu PIN para proteger a alteração dos dados da conta.'
            : 'Digite sua senha para proteger a alteração dos dados da conta.'}
        </AppText>
        <Field
          label={profile.hasPin ? 'PIN atual' : 'Senha atual'}
          value={credential}
          onChangeText={setCredential}
          secureTextEntry
          keyboardType={profile.hasPin ? 'number-pad' : 'default'}
          maxLength={profile.hasPin ? 6 : 128}
        />
      </Card>
      <ErrorNotice error={update.error} />
      <Button
        label="Salvar alterações"
        disabled={!credential || !name.trim() || !email.trim()}
        loading={update.isPending}
        onPress={() => update.mutate()}
      />
    </Screen>
  );
}
export function EditProfileScreen() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => authService.profile(session?.token ?? '', signal),
  });
  return (
    <Protected>
      {query.data ? (
        <ProfileForm key={query.data.id} profile={query.data} />
      ) : (
        <Screen title="Editar perfil">
          {query.isPending ? (
            <ActivityIndicator />
          ) : (
            <>
              <ErrorNotice error={query.error} />
              <Button
                label="Tentar novamente"
                onPress={() => {
                  void query.refetch();
                }}
              />
            </>
          )}
        </Screen>
      )}
    </Protected>
  );
}
