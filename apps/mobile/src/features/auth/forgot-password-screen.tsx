import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { forgotPasswordSchema, PASSWORD_RESET_TTL_MINUTES } from '@safewalk/contracts';
import { AppText, Icon } from '@/components/ui/primitives';
import { ThemeProvider } from '@/theme/theme-provider';
import { authService } from './auth.service';
import { AuthField } from './auth-field';
import { AuthError, AuthFooterLink, AuthLayout, AuthSubmit, useAuthStyles } from './auth-layout';

/** Abre localmente o link que iria por e-mail (só existe em desenvolvimento, sem SMTP). */
function openPreview(previewUrl: string) {
  const token = new URL(previewUrl).searchParams.get('token');
  if (token) router.push({ pathname: '/redefinir-senha', params: { token } });
}

function ForgotPasswordForm() {
  const { s, colors, compact } = useAuthStyles();
  const [email, setEmail] = useState('');
  const mutation = useMutation({
    mutationFn: () => authService.forgotPassword(forgotPasswordSchema.parse({ email }).email),
  });
  const submit = () => {
    if (!mutation.isPending) mutation.mutate();
  };

  if (mutation.data) {
    const { message, previewUrl } = mutation.data;
    return (
      <AuthLayout title="Confira seu e-mail" description={message} backFallback="/entrar">
        <View style={s.resetNotice}>
          <Icon name="mail" size={18} color={colors.primary} />
          <AppText style={s.resetNoticeText}>
            O link vale por {PASSWORD_RESET_TTL_MINUTES} minutos e funciona uma única vez. Se pedir
            de novo, só o link mais recente continua valendo.
          </AppText>
        </View>
        {previewUrl ? (
          <View style={s.resetPreview}>
            <AppText style={s.resetPreviewLabel}>
              Ambiente de desenvolvimento sem e-mail configurado: o link aparece aqui no lugar do
              e-mail.
            </AppText>
            <AuthFooterLink label="Abrir link de teste" onPress={() => openPreview(previewUrl)} />
          </View>
        ) : null}
        <AuthSubmit label="Voltar para entrar" onPress={() => router.replace('/entrar')} />
        <AuthFooterLink
          prompt="Não chegou?"
          label="Enviar de novo"
          onPress={() => mutation.reset()}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Esqueceu sua senha?"
      description="Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha."
      backFallback="/entrar"
    >
      <View style={s.authFields}>
        <AuthField
          label="E-mail"
          icon="mail"
          compact={compact}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          placeholder="seu@email.com"
          returnKeyType="send"
          onSubmitEditing={submit}
        />
      </View>
      <AuthError error={mutation.error} />
      <AuthSubmit
        label="Enviar link"
        pendingLabel="Enviando…"
        pending={mutation.isPending}
        onPress={submit}
      />
      <AuthFooterLink
        prompt="Lembrou a senha?"
        label="Entrar"
        onPress={() => router.replace('/entrar')}
      />
    </AuthLayout>
  );
}

export function ForgotPasswordScreen() {
  return (
    <ThemeProvider initialMode="light">
      <ForgotPasswordForm />
    </ThemeProvider>
  );
}
