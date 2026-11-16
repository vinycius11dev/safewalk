import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  adminResetPasswordSchema,
  passwordResetTokenSchema,
} from '@safewalk/contracts';
import { adminApi, ApiError } from '../../api/admin-client';
import { Icon } from '../../shared/icons';
import { AuthAlert, AuthField, AuthSubmit } from './auth-controls';
import { AuthLayout } from './auth-layout';

export type ResetFinish = 'login' | 'forgot' | 'changed';

/** Página aberta pelo link do e-mail (/redefinir-senha?token=...). */
export function ResetPasswordScreen({
  token,
  onFinish,
}: {
  token: string;
  onFinish: (next: ResetFinish) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; linkRejected: boolean } | null>(null);
  const [done, setDone] = useState(false);

  if (!passwordResetTokenSchema.safeParse(token).success)
    return (
      <AuthLayout
        title="Link inválido"
        description="Este link de redefinição está incompleto. Abra o link do e-mail de novo ou peça um novo."
      >
        <div className="auth-actions">
          <button className="auth-submit" type="button" onClick={() => onFinish('forgot')}>
            Pedir novo link
          </button>
          <button className="auth-link" type="button" onClick={() => onFinish('login')}>
            <Icon name="arrow-left" />
            Voltar para entrar
          </button>
        </div>
      </AuthLayout>
    );

  if (done)
    return (
      <AuthLayout
        title="Senha alterada"
        description="Sua nova senha já vale para entrar no painel."
      >
        <AuthAlert tone="success">
          Por segurança, as sessões que estavam abertas com a senha antiga foram encerradas.
        </AuthAlert>
        <button className="auth-submit" type="button" onClick={() => onFinish('changed')}>
          Entrar no painel
        </button>
      </AuthLayout>
    );

  const longEnough = password.length >= ADMIN_PASSWORD_MIN_LENGTH;
  const matches = password.length > 0 && password === confirmation;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const parsed = adminResetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setError({
        message: parsed.error.issues[0]?.message ?? 'Confira a nova senha.',
        linkRejected: false,
      });
      return;
    }
    if (!matches) {
      setError({ message: 'As duas senhas precisam ser iguais.', linkRejected: false });
      return;
    }
    setPending(true);
    setError(null);
    try {
      await adminApi.resetPassword(parsed.data.token, parsed.data.password);
      setDone(true);
    } catch (failure) {
      setError({
        message:
          failure instanceof ApiError
            ? failure.message
            : 'Não foi possível salvar a senha. Tente de novo.',
        linkRejected: failure instanceof ApiError && failure.code === 'RESET_LINK_INVALID',
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Criar nova senha"
      description="Uma frase curta e fácil de lembrar costuma ser mais segura que uma palavra com símbolos."
    >
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <AuthField
          label="Nova senha"
          icon="lock"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={ADMIN_PASSWORD_MIN_LENGTH}
        />
        <AuthField
          label="Confirme a nova senha"
          icon="lock"
          type="password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
        />
        <ul className="auth-checks" aria-label="Requisitos da senha">
          <li className={longEnough ? 'is-met' : undefined}>
            <Icon name="check" />
            Pelo menos {ADMIN_PASSWORD_MIN_LENGTH} caracteres
          </li>
          <li className={matches ? 'is-met' : undefined}>
            <Icon name="check" />
            As duas senhas são iguais
          </li>
        </ul>
        {error && <AuthAlert tone="error">{error.message}</AuthAlert>}
        <div className="auth-actions">
          <AuthSubmit label="Salvar nova senha" pendingLabel="Salvando…" pending={pending} />
          <button
            className="auth-link"
            type="button"
            onClick={() => onFinish(error?.linkRejected ? 'forgot' : 'login')}
          >
            <Icon name="arrow-left" />
            {error?.linkRejected ? 'Pedir novo link' : 'Voltar para entrar'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
