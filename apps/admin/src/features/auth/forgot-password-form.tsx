import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  forgotPasswordSchema,
  PASSWORD_RESET_TTL_MINUTES,
  type PasswordResetRequestResponse,
} from '@safewalk/contracts';
import { adminApi, ApiError } from '../../api/admin-client';
import { Icon } from '../../shared/icons';
import { AuthAlert, AuthField, AuthSubmit } from './auth-controls';

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<PasswordResetRequestResponse | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Informe um e-mail válido.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      setSent(await adminApi.forgotPassword(parsed.data.email));
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'Não foi possível enviar. Tente de novo.',
      );
    } finally {
      setPending(false);
    }
  };

  const back = (
    <button className="auth-link" type="button" onClick={onBack}>
      <Icon name="arrow-left" />
      Voltar para entrar
    </button>
  );

  if (sent)
    return (
      <div className="auth-form">
        <AuthAlert tone="info">
          <strong>Confira seu e-mail.</strong> {sent.message}
        </AuthAlert>
        <p className="muted small">
          O link vale por {PASSWORD_RESET_TTL_MINUTES} minutos e funciona uma única vez. Se pedir de
          novo, só o mais recente continua valendo.
        </p>
        {sent.previewUrl && (
          <div className="auth-preview">
            Ambiente de desenvolvimento sem e-mail configurado: o link aparece aqui no lugar do
            e-mail.
            <a className="auth-link" href={sent.previewUrl}>
              <Icon name="key" />
              Abrir link de teste
            </a>
          </div>
        )}
        <div className="auth-actions">
          <button className="auth-secondary" type="button" onClick={() => setSent(null)}>
            Enviar de novo
          </button>
          {back}
        </div>
      </div>
    );

  return (
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <AuthField
        label="E-mail"
        icon="mail"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="username"
        placeholder="nome@prefeitura.sp.gov.br"
      />
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      <div className="auth-actions">
        <AuthSubmit label="Enviar link" pendingLabel="Enviando…" pending={pending} />
        {back}
      </div>
    </form>
  );
}
