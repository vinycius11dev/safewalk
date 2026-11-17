import { useState } from 'react';
import { Linking, Platform, Share, View } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, useUiStyles } from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';
import { useContacts } from '@/features/contacts/use-contacts';
import { tripsService } from './trips.service';
import { useRevokeShareLink } from './use-trips';
import { normalizePhoneForWhatsApp, smsUrl, whatsAppUrl } from './emergency-message';

export function ShareTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const ui = useUiStyles();
  const contacts = useContacts();
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const links = useMutation({ mutationFn: () => tripsService.shares(session?.token ?? '', id) });
  const revoke = useRevokeShareLink(id);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [revokedIds, setRevokedIds] = useState<string[]>([]);
  const smsPlatform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';
  function confirmRevoke(contactId: string) {
    revoke.mutate(contactId, {
      onSuccess: () => {
        setRevokedIds((current) => [...current, contactId]);
        setConfirmingId(null);
      },
    });
  }
  async function copy(url: string) {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(url);
    } catch {
      setError(new Error('Não foi possível copiar. Use a opção de compartilhar.'));
    }
  }
  async function openChannel(contactId: string, url: string, channel: 'whatsapp' | 'sms') {
    setError(null);
    const contact = contacts.data?.find((item) => item.id === contactId);
    if (!contact) {
      setError(new Error('Contato não encontrado nesta conta.'));
      return;
    }
    const message = `Acompanhe meu trajeto no SafeWalk: ${url}`;
    try {
      if (channel === 'whatsapp') {
        const digits = normalizePhoneForWhatsApp(contact.phone);
        if (!digits) throw new Error('Este contato não tem um número compatível com o WhatsApp.');
        await Linking.openURL(whatsAppUrl(digits, message));
      } else {
        await Linking.openURL(smsUrl(contact.phone, message, smsPlatform));
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error(
              `Não foi possível abrir o ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} neste aparelho.`,
            ),
      );
    }
  }
  return (
    <Protected>
      <Screen title="Quem acompanha">
        <AppText tone="muted">
          Gere links individuais para os contatos escolhidos. Cada link expira ao final do trajeto.
          Os contatos com o link válido podem ver a posição enviada e seu telefone cadastrado
          durante o acompanhamento.
        </AppText>
        <AppText variant="small" tone="muted">
          Quem aceitou o convite e autorizou o e-mail recebe o link automaticamente quando o trajeto
          começa. Para os demais, use WhatsApp, SMS ou copie o link.
        </AppText>
        <ErrorNotice error={links.error ?? revoke.error ?? error} />
        <Button
          label={links.data ? 'Gerar novos links' : 'Criar links de acompanhamento'}
          loading={links.isPending}
          onPress={() => {
            setRevokedIds([]);
            setConfirmingId(null);
            links.mutate();
          }}
        />
        {links.data?.map((link) =>
          revokedIds.includes(link.contactId) ? (
            <Card key={link.contactId}>
              <AppText variant="heading">
                {contacts.data?.find((contact) => contact.id === link.contactId)?.name ??
                  'Contato de segurança'}
              </AppText>
              <AppText tone="muted">
                Link revogado. Quem tiver esse link não vê mais o trajeto. Gere novos links para
                voltar a compartilhar.
              </AppText>
            </Card>
          ) : (
            <Card key={link.contactId}>
              <AppText variant="heading">
                {contacts.data?.find((contact) => contact.id === link.contactId)?.name ??
                  'Contato de segurança'}
              </AppText>
              <AppText variant="small" tone="muted">
                Acesso exclusivo a este trajeto
              </AppText>
              <Button
                variant="secondary"
                label={copied === link.url ? 'Link copiado' : 'Copiar link'}
                icon="copy"
                onPress={() => {
                  void copy(link.url);
                }}
              />
              <View style={ui.row}>
                <View style={ui.grow}>
                  <Button
                    variant="secondary"
                    label="WhatsApp"
                    icon="send"
                    onPress={() => {
                      void openChannel(link.contactId, link.url, 'whatsapp');
                    }}
                  />
                </View>
                <View style={ui.grow}>
                  <Button
                    variant="secondary"
                    label="SMS"
                    icon="message-circle"
                    onPress={() => {
                      void openChannel(link.contactId, link.url, 'sms');
                    }}
                  />
                </View>
              </View>
              <AppText variant="small" tone="muted">
                O app abre a conversa com a mensagem pronta; o envio só acontece quando você tocar
                em enviar.
              </AppText>
              <Link
                href={{
                  pathname: '/acompanhar/[token]',
                  params: { token: new URL(link.url).pathname.split('/').at(-1) ?? '' },
                }}
                target="_blank"
                rel="noopener noreferrer"
              >
                <AppText tone="primary">Abrir acompanhamento</AppText>
              </Link>
              <Button
                variant="ghost"
                label="Compartilhar"
                icon="share-2"
                onPress={() => {
                  void Share.share({
                    message: `Acompanhe meu trajeto no SafeWalk: ${link.url}`,
                  }).catch(() => setError(new Error('Não foi possível abrir o compartilhamento.')));
                }}
              />
              {confirmingId === link.contactId ? (
                <>
                  <AppText variant="small" tone="muted">
                    Revogar o link deste contato? Ele deixa de ver o trajeto imediatamente.
                  </AppText>
                  <View style={ui.row}>
                    <View style={ui.grow}>
                      <Button
                        variant="secondary"
                        label="Cancelar"
                        disabled={revoke.isPending}
                        onPress={() => setConfirmingId(null)}
                      />
                    </View>
                    <View style={ui.grow}>
                      <Button
                        variant="danger"
                        label="Revogar"
                        loading={revoke.isPending}
                        onPress={() => confirmRevoke(link.contactId)}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <Button
                  variant="ghost"
                  label="Revogar link"
                  icon="slash"
                  onPress={() => {
                    revoke.reset();
                    setConfirmingId(link.contactId);
                  }}
                />
              )}
            </Card>
          ),
        )}
        {links.data?.length === 0 && (
          <AppText tone="muted">
            Nenhum contato foi selecionado para este trajeto. Adicione e convide seus contatos antes
            de começar um novo trajeto.
          </AppText>
        )}
      </Screen>
    </Protected>
  );
}
