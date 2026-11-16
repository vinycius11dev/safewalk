export function localTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  });
}
export function freshness(value: string | undefined, now: number): string {
  if (!value) return 'Aguardando primeira posição';
  const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  return seconds < 60
    ? `Atualizado há ${seconds} s`
    : `Atualizado há ${Math.floor(seconds / 60)} min`;
}
