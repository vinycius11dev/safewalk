import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/auth-provider';
import { LoadingScreen } from '@/components/layout/screen';

export function AppEntry() {
  const { session, ready } = useAuth();
  return ready ? <Redirect href={session ? '/inicio' : '/boas-vindas'} /> : <LoadingScreen />;
}
