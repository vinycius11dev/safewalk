import { useMemo, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { AppText, Icon } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/error-message';
import { useTheme } from '@/theme/theme-provider';
import { createAuthStyles } from './auth.styles';
import { AuthRouteIllustration } from './auth-route-illustration';
import { SafeWalkBrand } from './safewalk-brand';

/** Estilos das telas de acesso; `tall` reserva mais altura (formulários com mais campos). */
export function useAuthStyles(tall = false) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= 1000;
  const compact = height < 740 || (tall && height < 820);
  const s = useMemo(() => createAuthStyles(colors, { wide, compact }), [colors, wide, compact]);
  return { s, colors, wide, compact };
}

type AuthLayoutProps = PropsWithChildren<{
  title: string;
  description: string;
  tall?: boolean;
  /** Para onde o "Voltar" leva quando não há tela anterior (link aberto direto do e-mail). */
  backFallback?: Href;
}>;

/** Moldura comum de entrar, cadastro e recuperação de senha: marca, ilustração e painel. */
export function AuthLayout({
  title,
  description,
  tall = false,
  backFallback = '/inicio',
  children,
}: AuthLayoutProps) {
  const { s, colors, wide, compact } = useAuthStyles(tall);
  return (
    <KeyboardAvoidingView
      behavior={
        Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
      }
      style={s.keyboardRoot}
    >
      <Screen contentStyle={s.screenContent} keyboardAvoiding={false}>
        <View nativeID="safewalk-auth-form" style={s.form}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => (router.canGoBack() ? router.back() : router.replace(backFallback))}
            style={({ pressed }) => [s.backButton, pressed && s.backButtonPressed]}
          >
            <Icon name="arrow-left" size={20} color={colors.text} />
          </Pressable>

          <View nativeID="safewalk-auth-content" style={s.authContent}>
            <View nativeID="safewalk-auth-story" style={s.authStory}>
              <SafeWalkBrand
                size={compact ? 'compact' : 'regular'}
                layout={wide || compact ? 'horizontal' : 'stacked'}
                style={s.brandLockup}
              />
              {wide && (
                <View style={s.desktopStory}>
                  <AppText style={s.storyTitle}>Mais contexto em cada passo.</AppText>
                  <AppText style={s.storyDescription}>
                    Planeje seus caminhos a pé com as informações públicas disponíveis pelo trajeto.
                  </AppText>
                  <AuthRouteIllustration style={s.routeIllustration} />
                  <AppText style={s.illustrationCaption}>Ilustração de um percurso.</AppText>
                </View>
              )}
            </View>

            <View nativeID="safewalk-auth-panel" style={s.authPanel}>
              <View style={s.panelIntro}>
                <AppText accessibilityRole="header" variant="title" style={s.panelTitle}>
                  {title}
                </AppText>
                <AppText style={s.panelDescription}>{description}</AppText>
              </View>
              {children}
            </View>
          </View>

          <View style={s.privacyNote}>
            <Icon name="shield" size={14} color={colors.muted} />
            <AppText style={s.privacyText}>
              Seus contatos só veem sua localização nos trajetos que você inicia.
            </AppText>
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export function AuthError({ error, tall = false }: { error: unknown; tall?: boolean }) {
  const { s } = useAuthStyles(tall);
  return (
    <View style={s.errorSlot} accessibilityLiveRegion="polite">
      {error ? (
        <AppText accessibilityRole="alert" style={s.errorText}>
          {errorMessage(error)}
        </AppText>
      ) : null}
    </View>
  );
}

type AuthSubmitProps = {
  label: string;
  pendingLabel?: string;
  pending?: boolean;
  tall?: boolean;
  onPress: () => void;
};

export function AuthSubmit({
  label,
  pendingLabel = label,
  pending = false,
  tall = false,
  onPress,
}: AuthSubmitProps) {
  const { s, colors } = useAuthStyles(tall);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: pending, busy: pending }}
      disabled={pending}
      onPress={onPress}
      style={({ pressed }) => [
        s.authSubmit,
        pressed && s.authSubmitPressed,
        pending && s.authSubmitLoading,
      ]}
    >
      <AppText style={s.authSubmitText}>{pending ? pendingLabel : label}</AppText>
      {pending ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Icon name="arrow-right" size={20} color={colors.white} />
      )}
    </Pressable>
  );
}

/** Link de texto do rodapé das telas de acesso ("Criar uma conta", "Voltar para entrar"...). */
export function AuthFooterLink({
  prompt,
  label,
  onPress,
}: {
  prompt?: string;
  label: string;
  onPress: () => void;
}) {
  const { s } = useAuthStyles();
  return (
    <View style={s.authFooter}>
      {prompt ? <AppText style={s.footerText}>{prompt}</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [s.authFooterButton, pressed && s.authFooterPressed]}
      >
        <AppText style={s.authFooterLink}>{label}</AppText>
      </Pressable>
    </View>
  );
}
