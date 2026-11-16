import { router } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { AppText, Button } from '@/components/ui/primitives';
export default function NotFound() {
  return (
    <Screen title="Caminho não encontrado">
      <AppText variant="title">Vamos encontrar outro caminho.</AppText>
      <Button label="Voltar ao início" onPress={() => router.replace('/')} />
    </Screen>
  );
}
