import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { router } from 'expo-router';
import type { Session } from '@safewalk/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { readSession, writeSession } from '@/lib/session-storage';
import { observeSessionExpiration } from '@/lib/api-client';

type AuthValue = {
  session: Session | null;
  ready: boolean;
  accountDeletionConfirmed: boolean;
  confirmAccountDeletion: () => void;
  saveSession: (session: Session | null) => Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [accountDeletionConfirmed, setAccountDeletionConfirmed] = useState(false);
  const handlingExpiredSession = useRef(false);
  const queryClient = useQueryClient();
  useEffect(() => {
    let active = true;
    void readSession()
      .then((value) => {
        if (active) setSession(value);
      })
      .catch(() => {
        // Armazenamento ilegível equivale a sessão ausente: segue deslogado.
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const saveSession = useCallback(
    async (next: Session | null) => {
      await writeSession(next);
      queryClient.clear();
      setSession(next);
      if (next) setAccountDeletionConfirmed(false);
    },
    [queryClient],
  );
  useEffect(() => {
    if (session) handlingExpiredSession.current = false;
  }, [session]);
  useEffect(
    () =>
      observeSessionExpiration(() => {
        if (!session || handlingExpiredSession.current) return;
        handlingExpiredSession.current = true;
        void saveSession(null)
          .catch(() => {
            queryClient.clear();
            setSession(null);
          })
          .finally(() => {
            router.replace({ pathname: '/boas-vindas', params: { sessionExpired: '1' } });
          });
      }),
    [queryClient, saveSession, session],
  );
  const value = useMemo<AuthValue>(
    () => ({
      session,
      ready,
      accountDeletionConfirmed,
      confirmAccountDeletion: () => setAccountDeletionConfirmed(true),
      saveSession,
    }),
    [session, ready, saveSession, accountDeletionConfirmed],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider ausente.');
  return context;
}
