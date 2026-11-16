import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../../api/admin-client';
import { AuthAlert, AuthField, AuthSubmit } from './auth-controls';
import { AuthLayout } from './auth-layout';
import { ForgotPasswordForm } from './forgot-password-form';
import { useSession } from './session';

type Props = {
  expired: boolean;
  /** Acabou de criar uma senha nova pelo link do e-mail. */
  passwordChanged?: boolean;
  initialMode?: 'login' | 'forgot';
};

export function LoginScreen({ expired, passwordChanged = false, initialMode = 'login' }: Props) {
  const [mode, setMode] = useState(initialMode);
  if (mode === 'forgot')
    return (
      <AuthLayout
        title="Recuperar senha"
        description="Enviaremos um link para o e-mail cadastrado como operador."
      >
        <ForgotPasswordForm onBack={() => setMode('login')} />
      </AuthLayout>
    );
  return (
    <AuthLayout
      title="Entrar no painel"
      description="Acesso para operadores cadastrados pela Prefeitura."
    >
      <LoginForm
        expired={expired}
        passwordChanged={passwordChanged}
        onForgot={() => setMode('forgot')}
      />
    </AuthLayout>
  );
}

function LoginForm({
  expired,
  passwordChanged,
  onForgot,
}: {
  expired: boolean;
  passwordChanged: boolean;
  onForgot: () => void;
}) {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'Não foi possível entrar. Tente de novo.',
      );
      setPending(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      {passwordChanged ? (
        <AuthAlert tone="success">
          Senha alterada. Entre com a nova senha; as sessões abertas antes foram encerradas.
        </AuthAlert>
      ) : (
        expired && (
          <AuthAlert tone="info">Sua sessão terminou. Entre de novo para continuar.</AuthAlert>
        )
      )}
      <AuthField
        label="E-mail"
        icon="mail"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="username"
        placeholder="nome@prefeitura.sp.gov.br"
      />
      <AuthField
        label="Senha"
        icon="lock"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        placeholder="Sua senha"
      />
      <div className="auth-row-end">
        <button className="auth-link" type="button" onClick={onForgot}>
          Esqueci minha senha
        </button>
      </div>
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      <AuthSubmit label="Entrar" pendingLabel="Entrando…" pending={pending} />
    </form>
  );
}
