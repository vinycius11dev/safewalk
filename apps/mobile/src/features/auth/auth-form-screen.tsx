import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, registerSchema } from '@safewalk/contracts';
import { AppText } from '@/components/ui/primitives';
import { ThemeProvider } from '@/theme/theme-provider';
import { useAuth } from './auth-provider';
import { authService } from './auth.service';
import { AuthField } from './auth-field';
import { AuthError, AuthFooterLink, AuthLayout, AuthSubmit, useAuthStyles } from './auth-layout';

function AuthForm({ register }: { register: boolean }) {
  const { s, compact } = useAuthStyles(register);
  const { saveSession } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      if (register) {
        const input = registerSchema.parse({ name, email, password });
        return authService.register(input.name, input.email, input.password);
      }
      const input = loginSchema.parse({ email, password });
      return authService.login(input.email, input.password);
    },
    onSuccess: async (session) => {
      await saveSession(session);
      router.replace(register ? '/permissoes' : '/inicio');
    },
  });
  const submit = () => {
    if (!mutation.isPending) mutation.mutate();
  };

  return (
    <AuthLayout
      tall={register}
      title={register ? 'Crie sua conta' : 'Entre na sua conta'}
      description={
        register ? 'Sua próxima caminhada começa por aqui.' : 'Seu próximo caminho começa aqui.'
      }
    >
      <View style={s.authFields}>
        {register && (
          <AuthField
            label="Seu nome"
            icon="user"
            compact={compact}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            placeholder="Como podemos chamar você?"
          />
        )}
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
        />
        <AuthField
          label="Senha"
          icon="lock"
          compact={compact}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={register ? 'new-password' : 'current-password'}
          placeholder={register ? 'Pelo menos 8 caracteres' : 'Digite sua senha'}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      {!register && (
        <View style={s.forgotRow}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Esqueci minha senha"
            onPress={() => router.push('/esqueci-senha')}
            style={({ pressed }) => [s.forgotButton, pressed && s.authFooterPressed]}
          >
            <AppText style={s.authFooterLink}>Esqueci minha senha</AppText>
          </Pressable>
        </View>
      )}

      <AuthError error={mutation.error} tall={register} />
      <AuthSubmit
        tall={register}
        label={register ? 'Criar minha conta' : 'Entrar'}
        pendingLabel={register ? 'Criando conta…' : 'Entrando…'}
        pending={mutation.isPending}
        onPress={submit}
      />
      <AuthFooterLink
        prompt={register ? 'Já tem uma conta?' : 'Primeira vez por aqui?'}
        label={register ? 'Entrar' : 'Criar uma conta'}
        onPress={() => router.replace(register ? '/entrar' : '/cadastro')}
      />
    </AuthLayout>
  );
}

function AuthEntry({ register }: { register: boolean }) {
  return (
    <ThemeProvider initialMode="light">
      <AuthForm register={register} />
    </ThemeProvider>
  );
}

export function LoginScreen() {
  return <AuthEntry register={false} />;
}

export function RegisterScreen() {
  return <AuthEntry register />;
}
