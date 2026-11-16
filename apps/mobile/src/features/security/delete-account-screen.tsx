import { useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';
import { authService } from '@/features/auth/auth.service';

export function DeleteAccountScreen() {
  const { session, saveSession, confirmAccountDeletion } = useAuth();
  const [consent, setConsent] = useState(false);
  const [credential, setCredential] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      authService.deleteAccount(
        session?.token ?? '',
        session?.user.hasPin ? { pin: credential } : { password: credential },
      ),
    onSuccess: async () => {
      confirmAccountDeletion();
      await saveSession(null);
      router.replace('/conta-excluida');
    },
  });
  return (
    <Protected>
      <Screen title="Excluir sua conta">
        <Icon name="trash-2" size={38} />
        <AppText variant="title">Antes de se despedir.</AppText>
        <Card>
          <AppText variant="subtitle">O que será apagado</AppText>
          <AppText tone="muted">
            • Perfil, PIN e preferências{'\n'}• Histórico de rotas, posições e alertas{'\n'}• Lista
            de contatos e convites{'\n'}• Seus relatos e a autoria registrada
          </AppText>
        </Card>
        <AppText tone="danger">
          A conta será desativada agora. O acompanhamento será encerrado e os dados serão apagados
          em até 15 dias. Não há opção de restaurar a conta neste aplicativo.
        </AppText>
        <Button
          label="Baixar meus dados antes"
          variant="secondary"
          icon="download"
          onPress={() => router.push('/privacidade')}
        />
        <Card>
          <AppText variant="small" tone="muted">
            Seus trajetos ativos serão encerrados e os links deixarão de disponibilizar localização.
            A exclusão dos dados é processada em até 15 dias.
          </AppText>
          <Field
            label={session?.user.hasPin ? 'Confirme seu PIN' : 'Confirme sua senha'}
            value={credential}
            onChangeText={setCredential}
            secureTextEntry
            keyboardType={session?.user.hasPin ? 'number-pad' : 'default'}
            maxLength={session?.user.hasPin ? 6 : 128}
          />
        </Card>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          aria-checked={consent}
          onPress={() => setConsent(!consent)}
        >
          <AppText>
            {consent ? '☑' : '☐'} Entendo que minha conta será desativada agora e meus dados serão
            excluídos em até 15 dias.
          </AppText>
        </Pressable>
        <ErrorNotice error={mutation.error} />
        <Button
          label="Excluir minha conta"
          variant="danger"
          disabled={!consent || !credential}
          loading={mutation.isPending}
          onPress={() => mutation.mutate()}
        />
        <Button
          label="Manter minha conta"
          variant="ghost"
          onPress={() => router.replace('/seguranca')}
        />
      </Screen>
    </Protected>
  );
}
