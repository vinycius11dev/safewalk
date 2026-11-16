import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Screen } from '@/components/layout/screen';
import { AppText, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { SafeWalkMark } from '@/components/ui/safewalk-mark';
import { MapScene } from '@/components/map/map-scene';
import { useTheme } from '@/theme/theme-provider';
import { useAuth } from './auth-provider';
import { authService } from './auth.service';
import { createAuthStyles } from './auth.styles';

export function WelcomeScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createAuthStyles(colors), [colors]);
  const { sessionExpired } = useLocalSearchParams<{ sessionExpired?: string }>();
  const { saveSession } = useAuth();
  const demo = useMutation({
    mutationFn: authService.demo,
    onSuccess: async (session) => {
      await saveSession(session);
      router.replace('/roteiro-demo');
    },
  });
  return (
    <Screen scroll={false}>
      <ScrollView contentContainerStyle={s.welcome}>
        <View style={s.brand}>
          <View style={s.brandIcon}>
            <SafeWalkMark size={28} tone="tile" />
          </View>
          <AppText style={s.brandText}>SafeWalk</AppText>
        </View>
        <View style={s.hero}>
          <MapScene variant="routes" adaptive={false} />
          <View style={s.heroMark}>
            <SafeWalkMark size={58} tone="tile" />
          </View>
        </View>
        <AppText style={s.welcomeTitle}>Caminhe por São Paulo com mais contexto</AppText>
        <View style={s.benefits}>
          {[
            ['navigation', 'Rotas com menos registros, com o motivo de cada alerta'],
            ['users', 'Contatos veem o roteiro e a última posição recebida'],
            ['shield', 'Se passar do horário, o app pergunta e mostra o alerta a quem acompanha'],
          ].map(([icon, text]) => (
            <View key={text} style={s.benefit}>
              <Icon
                name={icon === 'navigation' ? 'navigation' : icon === 'users' ? 'users' : 'shield'}
                color={colors.primaryText}
              />
              <AppText style={s.benefitText}>{text}</AppText>
            </View>
          ))}
        </View>
        <View style={s.footer}>
          <ErrorNotice
            error={
              sessionExpired === '1'
                ? new Error('Sua sessão expirou. Entre novamente para continuar.')
                : demo.error
            }
          />
          <Button label="Começar" onPress={() => router.push('/cadastro')} />
          <Button
            label="Já tenho conta · Entrar"
            variant="ghost"
            onPress={() => router.push('/entrar')}
          />
          <Button
            label="Explorar demonstração"
            variant="secondary"
            icon="play"
            loading={demo.isPending}
            onPress={() => demo.mutate()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
