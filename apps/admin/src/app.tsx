import { useEffect, useState } from 'react';
import { LoginScreen } from './features/auth/login-screen';
import { ResetPasswordScreen, type ResetFinish } from './features/auth/reset-password-screen';
import { useSession } from './features/auth/session';
import { Shell } from './shell';

const RESET_PATH = '/redefinir-senha';

/** Token do link de redefinição, lido uma vez ao abrir a página (null fora dessa rota). */
function resetTokenFromLocation(): string | null {
  if (window.location.pathname !== RESET_PATH) return null;
  return new URLSearchParams(window.location.search).get('token') ?? '';
}

export function App() {
  const { state, signOut } = useSession();
  const [resetToken, setResetToken] = useState(resetTokenFromLocation);
  const [after, setAfter] = useState<ResetFinish | null>(null);

  // Tira o token da barra de endereço e do histórico assim que ele foi lido.
  useEffect(() => {
    if (resetToken !== null && window.location.search)
      window.history.replaceState(null, '', RESET_PATH);
  }, [resetToken]);

  if (resetToken !== null)
    return (
      <ResetPasswordScreen
        token={resetToken}
        onFinish={(next) => {
          window.history.replaceState(null, '', '/');
          if (next === 'changed') signOut();
          setAfter(next);
          setResetToken(null);
        }}
      />
    );
  if (state.status === 'checking')
    return (
      <main className="splash" aria-busy="true">
        <div className="spinner" role="status" aria-label="Verificando acesso" />
      </main>
    );
  if (state.status === 'out')
    return (
      <LoginScreen
        expired={state.expired}
        passwordChanged={after === 'changed'}
        initialMode={after === 'forgot' ? 'forgot' : 'login'}
      />
    );
  return <Shell />;
}
