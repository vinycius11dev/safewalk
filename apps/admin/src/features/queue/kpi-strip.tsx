import type { AdminSummary } from '@safewalk/contracts';
import { useSummary } from '../../api/queries';
import { formatDuration } from '../../shared/format';

type Tile = { label: string; value: string; tone?: 'alert' };

/** Só entram os números que a API informa; sem casos resolvidos, o tempo médio fica de fora. */
function tilesOf({ counts, averageResolutionHours }: AdminSummary): Tile[] {
  const count = (value: number) => value.toLocaleString('pt-BR');
  return [
    { label: 'Em aberto', value: count(counts.open) },
    { label: 'Novos em 24 h', value: count(counts.receivedLast24h) },
    {
      label: 'Prioridade alta',
      value: count(counts.highPriorityOpen),
      tone: counts.highPriorityOpen > 0 ? 'alert' : undefined,
    },
    ...(averageResolutionHours === null
      ? []
      : [{ label: 'Tempo até resolver', value: formatDuration(averageResolutionHours) }]),
    { label: 'Resolvidos em 7 dias', value: count(counts.resolvedLast7d) },
  ];
}

const PLACEHOLDERS = ['a', 'b', 'c', 'd', 'e'];

/** Faixa de indicadores que flutua no topo do mapa. */
export function KpiStrip() {
  const summary = useSummary();
  if (!summary.data && summary.isError)
    return (
      <p className="kpi-strip kpi-strip-note float" role="status">
        Indicadores indisponíveis agora. A fila continua funcionando.
      </p>
    );
  if (!summary.data)
    return (
      <ul className="kpi-strip float" aria-busy="true" aria-label="Carregando indicadores">
        {PLACEHOLDERS.map((key) => (
          <li key={key} className="kpi-tile kpi-tile-loading" />
        ))}
      </ul>
    );
  return (
    <ul className="kpi-strip float" aria-label="Indicadores dos relatos">
      {tilesOf(summary.data).map((tile) => (
        <li key={tile.label} className={`kpi-tile${tile.tone ? ` kpi-tile-${tile.tone}` : ''}`}>
          <span className="kpi-tile-label">{tile.label}</span>
          <strong key={tile.value} className="kpi-tile-value num">
            {tile.value}
          </strong>
        </li>
      ))}
    </ul>
  );
}
