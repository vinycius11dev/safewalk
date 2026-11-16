import type { TripStartEmailNotification } from '@safewalk/contracts';
import { AppText, Badge, Card } from '@/components/ui/primitives';

export function TripStartEmailNotice({
  notifications,
}: {
  notifications: readonly TripStartEmailNotification[];
}) {
  const accepted = notifications.filter((item) => item.status === 'accepted_by_relay').length;
  const notConfigured = notifications.filter((item) => item.status === 'not_configured').length;
  const failed = notifications.filter((item) => item.status === 'failed').length;
  const notEnabled = notifications.filter((item) => item.status === 'not_enabled').length;
  if (notifications.length === 0) return null;

  return (
    <Card>
      <Badge label="Avisos por e-mail" />
      {accepted > 0 && (
        <AppText variant="small" tone="muted">
          O servidor de e-mail aceitou o envio para {accepted} contato{accepted === 1 ? '' : 's'}.
          Isso não confirma a chegada à caixa de entrada.
        </AppText>
      )}
      {notConfigured > 0 && (
        <AppText variant="small" tone="muted">
          O envio automático não está configurado neste servidor. Os links de acompanhamento
          continuam disponíveis no app.
        </AppText>
      )}
      {failed > 0 && (
        <AppText variant="small" tone="danger">
          Não foi possível enviar {failed === 1 ? 'um e-mail' : `${failed} e-mails`}. O trajeto
          segue ativo e o link pode ser compartilhado manualmente.
        </AppText>
      )}
      {notEnabled > 0 && (
        <AppText variant="small" tone="muted">
          Contatos sem autorização de e-mail não recebem o aviso. O link de acompanhamento só é
          enviado a quem aceitou e ativou essa opção.
        </AppText>
      )}
    </Card>
  );
}
