import { Share } from 'react-native';

export async function exportPersonalData(data: unknown): Promise<string> {
  const result = await Share.share(
    { title: 'Meus dados SafeWalk', message: JSON.stringify(data, null, 2) },
    { dialogTitle: 'Salvar meus dados SafeWalk' },
  );
  return result.action === Share.dismissedAction
    ? 'Compartilhamento cancelado.'
    : 'Dados preparados no compartilhamento do aparelho. Confira o destino escolhido.';
}
