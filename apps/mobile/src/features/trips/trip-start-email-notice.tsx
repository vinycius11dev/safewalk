import type { TripStartEmailNotification } from '@safewalk/contracts';
import { AppText, Badge, Card } from '@/components/ui/primitives';

export function TripStartEmailNotice({
  notifications,
}: {
  notifications: readonly TripStartEmailNotification[];
}) {
  const accepted = notifications.filter((item) => item.status === 'accepted_by_relay').length;
  const sending = notifications.filter((item) => item.status === 'sending').length;
  const notConfigured = notifications.filter((item) => item.status === 'not_configured').length;
  const failed = notifications.filter((item) => item.status === 'failed').length;
  const notEnabled = notifications.filter((item) => item.status === 'not_enabled').length;
  if (notifications.length === 0) return null;

  return (
    <Card>
      <Badge label="Link por e-mail" tone={accepted + sending > 0 ? 'success' : undefined} />
      {accepted > 0 && (
        <AppText variant="small" tone="muted">
          Link de acompanhamento enviado por e-mail para {accepted} contato
          {accepted === 1 ? '' : 's'}.
        </AppText>
      )}
      {sending > 0 && (
        <AppText variant="small" tone="muted">
          Enviando o link de acompanhamento por e-mail para {sending} contato
          {sending === 1 ? '' : 's'}.
        </AppText>
      )}
      {notConfigured > 0 && (
        <AppText variant="small" tone="muted">
          O envio por e-mail não está disponível agora. Compartilhe o link pelo app em Compartilhar
          trajeto.
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
          Quem ainda não autorizou o e-mail no convite não recebe o link automaticamente; envie por
          Compartilhar trajeto.
        </AppText>
      )}
    </Card>
  );
}
