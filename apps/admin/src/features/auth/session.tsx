import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AdminUser } from '@safewalk/contracts';
import { adminApi, readToken, setSessionExpiredHandler } from '../../api/admin-client';

type SessionState =
  { status: 'checking' } | { status: 'out'; expired: boolean } | { status: 'in'; user: AdminUser };

type SessionApi = {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [state, setState] = useState<SessionState>(
    readToken() ? { status: 'checking' } : { status: 'out', expired: false },
  );

  useEffect(() => {
    setSessionExpiredHandler(() => {
      client.clear();
      setState({ status: 'out', expired: true });
    });
    return () => setSessionExpiredHandler(null);
  }, [client]);

  useEffect(() => {
    if (state.status !== 'checking') return;
    let active = true;
    adminApi
      .me()
      .then((user) => {
        if (active) setState({ status: 'in', user });
      })
      .catch(() => {
        if (active) setState({ status: 'out', expired: true });
      });
    return () => {
      active = false;
    };
  }, [state.status]);

  const signIn = useCallback(async (email: string, password: string) => {
    const user = await adminApi.login(email, password);
    setState({ status: 'in', user });
  }, []);
  const signOut = useCallback(() => {
    adminApi.logout();
    client.clear();
    setState({ status: 'out', expired: false });
  }, [client]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession fora do SessionProvider.');
  return value;
}
