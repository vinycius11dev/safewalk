import { Redirect, router } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { AppText, Button, Card, Icon } from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';

export function AccountDeletedScreen() {
  const { accountDeletionConfirmed } = useAuth();
  if (!accountDeletionConfirmed) return <Redirect href="/boas-vindas" />;
  return (
    <Screen title="Solicitação registrada" back={false}>
      <Icon name="shield" size={42} />
      <AppText variant="title">Sua conta foi desativada.</AppText>
      <AppText tone="muted">
        O acesso à conta foi encerrado. Os links de acompanhamento deixaram de disponibilizar sua
        localização.
      </AppText>
      <Card>
        <AppText variant="subtitle">Exclusão em até 15 dias</AppText>
        <AppText tone="muted">
          Perfil, PIN, preferências, histórico, contatos e relatos serão removidos pelo processador
          de privacidade. Não há opção de restaurar a conta nesta versão.
        </AppText>
      </Card>
      <Button label="Voltar ao início" onPress={() => router.replace('/boas-vindas')} />
    </Screen>
  );
}
