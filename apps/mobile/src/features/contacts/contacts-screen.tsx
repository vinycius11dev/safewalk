import { useMemo } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useContacts } from './use-contacts';
import { createContactStyles } from './contacts.styles';

export function ContactsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createContactStyles(colors), [colors]);
  const contacts = useContacts();
  return (
    <Protected>
      <Screen title="Contatos de segurança" back={false} tabs>
        <AppText tone="muted">
          Quem caminha com você, mesmo à distância. Até 5 contatos. Você escolhe quem acompanha
          antes de iniciar cada trajeto.
        </AppText>
        {contacts.isPending && <ActivityIndicator color={colors.primary} />}
        <ErrorNotice error={contacts.error} />
        {contacts.isError && (
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
            accessibilityRole="button"
            accessibilityLabel={`Ver contato ${contact.name}`}
            onPress={() => router.push({ pathname: '/contato/[id]', params: { id: contact.id } })}
          >
            <Card>
              <View style={s.card}>
                <View style={[s.avatar, index % 2 === 1 && s.avatarSecond]}>
                  <AppText style={s.avatarText}>{contact.name.charAt(0)}</AppText>
                </View>
                <View style={s.body}>
                  <AppText variant="subtitle">{contact.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {contact.relationship} · {contact.phone}
                  </AppText>
                  <Badge
                    label={contact.accepted ? 'Convite aceito' : 'Convite pendente'}
                    tone={contact.accepted ? 'success' : 'warning'}
                  />
                </View>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </View>
            </Card>
          </Pressable>
        ))}
        {!contacts.isPending && !contacts.isError && !contacts.data?.length && (
          <Card>
            <Icon name="users" size={36} />
            <AppText variant="heading">Você não precisa caminhar só.</AppText>
            <AppText tone="muted">
              Adicione alguém de confiança. O contato só acompanha depois de aceitar seu convite.
            </AppText>
          </Card>
        )}
        <Button
          label="Adicionar contato"
          icon="user-plus"
          onPress={() => router.push('/adicionar-contato')}
        />
        <Card>
          <Icon name="shield" color={colors.primaryText} />
          <AppText variant="subtitle">Compartilhamento por escolha</AppText>
          <AppText variant="small" tone="muted">
            O link funciona somente durante o trajeto e tem prazo limitado. Seus contatos não têm
            acesso ao histórico.
          </AppText>
        </Card>
        <AppText variant="small" tone="muted">
          O envio automático por WhatsApp/SMS ainda não está integrado. Você pode copiar e
          compartilhar o convite.
        </AppText>
        <Button
          label="Escolher minha rota"
          variant="ghost"
          onPress={() => router.push('/buscar')}
        />
      </Screen>
    </Protected>
  );
}
