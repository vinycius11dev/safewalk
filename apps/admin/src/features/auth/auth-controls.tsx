import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../../shared/icons';

type FieldProps = {
  label: string;
  icon: IconName;
  type: 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
};

/** Campo das telas de acesso: ícone, mostrar/ocultar senha e aviso de Caps Lock. */
export function AuthField({
  label,
  icon,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
}: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const secret = type === 'password';
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-control">
        <Icon name={icon} />
        <input
          id={id}
          type={secret && visible ? 'text' : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyUp={secret ? (event) => setCapsLock(event.getModifierState('CapsLock')) : undefined}
          onBlur={() => setCapsLock(false)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder}
          minLength={minLength}
          aria-describedby={capsLock ? `${id}-caps` : undefined}
          required
        />
        {secret && (
          <button
            type="button"
            className="auth-reveal"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
          >
            <Icon name={visible ? 'eye-off' : 'eye'} />
          </button>
        )}
      </div>
      {capsLock && (
        <p id={`${id}-caps`} className="auth-hint">
          <Icon name="alert" />
          Caps Lock está ativado.
        </p>
      )}
    </div>
  );
}

export function AuthAlert({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  const icon: IconName = tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'mail-check';
  return (
    <div className={`auth-alert auth-alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function AuthSubmit({
  label,
  pendingLabel,
  pending,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
}) {
  return (
    <button className="auth-submit" type="submit" disabled={pending} aria-busy={pending}>
      {pending && <span className="auth-spinner" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  );
}
