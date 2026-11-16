import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Badge, Button, Card, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { useContacts } from '@/features/contacts/use-contacts';
import { useStartTrip, useTrips } from './use-trips';
import { useAdultCompanion } from './use-adult-companion';
import { AdultCompanionCheck } from './adult-companion-check';
import { createTimerSetupStyles } from './timer-setup-screen.styles';

const durations = [10, 15, 20, 30, 45, 60] as const;

export function TimerSetupScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createTimerSetupStyles(colors), [colors]);
  const { session } = useAuth();
  const contacts = useContacts();
  const trips = useTrips();
  const start = useStartTrip();
  const adult = useAdultCompanion();
  const [minutes, setMinutes] = useState<number>(20);
  const [label, setLabel] = useState('');
  const accepted = contacts.data?.filter((contact) => contact.accepted) ?? [];
  const [selected, setSelected] = useState<string[] | null>(null);
  const [soloConfirmed, setSoloConfirmed] = useState(false);
  const contactIds = selected ?? accepted.filter((c) => c.defaultAccompany).map((c) => c.id);
  const activeTrip = trips.data?.find((trip) => !['arrived', 'cancelled'].includes(trip.status));
  function toggleContact(id: string) {
    setSelected(
      (contactIds.includes(id)
        ? contactIds.filter((item) => item !== id)
        : [...contactIds, id]
      ).filter((item) => accepted.some((contact) => contact.id === item)),
    );
  }
  function begin() {
    if (activeTrip) {
      router.push({ pathname: '/trajeto/[id]', params: { id: activeTrip.id } });
      return;
    }
    if (!session?.user.hasPin) {
      router.push('/pin');
      return;
    }
    start.mutate(
      {
        routeKind: 'faster',
        contactIds,
        destination: label.trim() || 'Acompanhamento por tempo',
        timerMinutes: minutes,
        ...adult.startInput,
      },
      {
        onSuccess: ({ trip }) =>
          router.replace({ pathname: '/trajeto/[id]', params: { id: trip.id } }),
      },
    );
  }
  const ready =
    contacts.data !== undefined &&
    (contactIds.length > 0 || soloConfirmed || accepted.length === 0);
  return (
    <Protected>
      <Screen title="Modo tempo">
        <AppText tone="muted">
          Escolha por quanto tempo seus contatos acompanham você, sem calcular uma rota. No final do
          tempo, o app pede um check-in.
        </AppText>
        <Badge label="Sem rota calculada" />
        <Field
          label="Nome do acompanhamento (opcional)"
          value={label}
          onChangeText={setLabel}
          placeholder="Acompanhamento por tempo"
          maxLength={200}
        />
        <AppText style={s.sectionLabel}>DURAÇÃO</AppText>
        <View style={s.choiceRow}>
          {durations.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={`${value} minutos`}
              accessibilityState={{ checked: minutes === value }}
              aria-checked={minutes === value}
              style={[s.choice, minutes === value && s.optionSelected]}
              onPress={() => setMinutes(value)}
            >
              <AppText variant="subtitle">{value} min</AppText>
            </Pressable>
          ))}
        </View>
        <AppText style={s.sectionLabel}>QUEM ACOMPANHA</AppText>
        {contacts.isPending && <ActivityIndicator color={colors.primary} />}
        <ErrorNotice error={contacts.error ?? trips.error ?? start.error} />
        {accepted.length > 0 ? (
          <View style={s.contactRow}>
            {accepted.map((contact) => (
              <Pressable
                key={contact.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: contactIds.includes(contact.id) }}
                aria-checked={contactIds.includes(contact.id)}
                style={[s.contactChip, contactIds.includes(contact.id) && s.optionSelected]}
                onPress={() => toggleContact(contact.id)}
              >
                <Icon
                  name={contactIds.includes(contact.id) ? 'check-circle' : 'circle'}
                  size={16}
                  color={colors.primaryText}
                />
                <AppText variant="small">{contact.name}</AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          <AppText variant="small" tone="muted">
            Nenhum contato aceito ainda. Você pode convidar contatos ou seguir sem acompanhamento.
          </AppText>
        )}
        {accepted.length > 0 && contactIds.length === 0 && (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: soloConfirmed }}
            aria-checked={soloConfirmed}
            style={s.contactChip}
            onPress={() => setSoloConfirmed((value) => !value)}
          >
            <Icon
              name={soloConfirmed ? 'check-square' : 'square'}
              size={16}
              color={colors.primaryText}
            />
            <AppText variant="small">Seguir sem acompanhamento neste trajeto</AppText>
          </Pressable>
        )}
        {accepted.length === 0 && (
          <Card>
            <AppText variant="small" tone="muted">
              Sem contatos, o acompanhamento por tempo fica só no seu aparelho: nenhum link é criado
              e ninguém é avisado se o check-in passar.
            </AppText>
            <Button
              label="Convidar um contato"
              variant="secondary"
              onPress={() => router.push('/contatos')}
            />
          </Card>
        )}
        {!session?.user.hasPin && (
          <AppText variant="small" tone="muted">
            É preciso configurar o PIN de segurança antes de iniciar.
          </AppText>
        )}
        {!activeTrip && (
          <AdultCompanionCheck
            required={adult.required}
            confirmed={adult.confirmed}
            onToggle={adult.toggle}
          />
        )}
        <Button
          label={
            activeTrip
              ? 'Retomar trajeto'
              : !session?.user.hasPin
                ? 'Configurar PIN e continuar'
                : `Iniciar ${minutes} min de acompanhamento`
          }
          disabled={!activeTrip && (!ready || adult.blocked || contacts.isPending)}
          loading={start.isPending}
          onPress={begin}
        />
      </Screen>
    </Protected>
  );
}
