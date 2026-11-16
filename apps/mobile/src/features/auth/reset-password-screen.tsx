import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { passwordResetTokenSchema, resetPasswordSchema } from '@safewalk/contracts';
import { AppText, Icon } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api-client';
import { ThemeProvider } from '@/theme/theme-provider';
import { useAuth } from './auth-provider';
import { authService } from './auth.service';
import { AuthField } from './auth-field';
import { AuthError, AuthFooterLink, AuthLayout, AuthSubmit, useAuthStyles } from './auth-layout';

function ResetPasswordForm() {
  const { s, colors, compact } = useAuthStyles(true);
  const { session, saveSession } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const tokenLooksValid = passwordResetTokenSchema.safeParse(token).success;
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      const input = resetPasswordSchema.parse({ token, password });
      if (password !== confirmation) throw new Error('As duas senhas precisam ser iguais.');
      await authService.resetPassword(input.token, input.password);
    },
    // A troca encerra as sessões abertas, inclusive a deste aparelho, se houver.
    onSuccess: async () => {
      if (session) await saveSession(null);
    },
  });
  const submit = () => {
    if (!mutation.isPending) mutation.mutate();
  };
  const linkRejected =
    mutation.error instanceof ApiError && mutation.error.code === 'RESET_LINK_INVALID';

  if (!tokenLooksValid)
    return (
      <AuthLayout
        title="Link inválido"
        description="Este link de redefinição está incompleto. Abra o link do e-mail de novo ou peça um novo."
        backFallback="/entrar"
      >
        <AuthSubmit label="Pedir novo link" onPress={() => router.replace('/esqueci-senha')} />
        <AuthFooterLink label="Voltar para entrar" onPress={() => router.replace('/entrar')} />
      </AuthLayout>
    );

  if (mutation.isSuccess)
    return (
      <AuthLayout
        title="Senha alterada"
        description="Pronto! Agora é só entrar com a nova senha."
        backFallback="/entrar"
      >
        <View style={s.resetNotice}>
          <Icon name="shield" size={18} color={colors.primary} />
          <AppText style={s.resetNoticeText}>
            Por segurança, encerramos as sessões que estavam abertas em outros aparelhos.
          </AppText>
        </View>
        <AuthSubmit label="Entrar" onPress={() => router.replace('/entrar')} />
      </AuthLayout>
    );

  return (
    <AuthLayout
      tall
      title="Crie uma nova senha"
      description="Use pelo menos 8 caracteres. Evite repetir a senha de outros serviços."
      backFallback="/entrar"
    >
      <View style={s.authFields}>
        <AuthField
          label="Nova senha"
          icon="lock"
          compact={compact}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="Pelo menos 8 caracteres"
        />
        <AuthField
          label="Confirme a nova senha"
          icon="lock"
          compact={compact}
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="Digite a mesma senha"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <AuthError error={mutation.error} tall />
      <AuthSubmit
        tall
        label="Salvar nova senha"
        pendingLabel="Salvando…"
        pending={mutation.isPending}
        onPress={submit}
      />
      {linkRejected ? (
        <AuthFooterLink label="Pedir novo link" onPress={() => router.replace('/esqueci-senha')} />
      ) : (
        <AuthFooterLink label="Voltar para entrar" onPress={() => router.replace('/entrar')} />
      )}
    </AuthLayout>
  );
}

export function ResetPasswordScreen() {
  return (
    <ThemeProvider initialMode="light">
      <ResetPasswordForm />
    </ThemeProvider>
  );
}
