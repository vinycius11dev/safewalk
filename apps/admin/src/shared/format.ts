const zone = 'America/Sao_Paulo';
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: zone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const clock = new Intl.DateTimeFormat('pt-BR', {
  timeZone: zone,
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));
export const formatClock = (date: Date): string => clock.format(date);

/** "há 5 min", "há 3 h", "há 2 dias": o suficiente para ordenar a fila a olho. */
export function formatAge(iso: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return 'agora';
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `há ${Math.floor(elapsed / HOUR)} h`;
  const days = Math.floor(elapsed / DAY);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/** Duração média: "5,5 h" abaixo de dois dias, "3,2 dias" acima. */
export function formatDuration(hours: number): string {
  if (hours < 48) return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
  return `${(hours / 24).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias`;
}

/** "13/11" a partir de "2026-11-13", sem passar por fuso. */
export function formatDay(day: string): string {
  const [, month, date] = day.split('-');
  return `${date}/${month}`;
}
