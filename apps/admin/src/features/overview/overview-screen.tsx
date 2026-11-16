import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import type { Coordinates, ReportType } from '@safewalk/contracts';
import { useSummary } from '../../api/queries';
import { formatAge, formatClock, formatDuration } from '../../shared/format';
import { TypeBadge } from '../../shared/report-types';
import { DailyChart } from './daily-chart';
import { StatusBar, TypeBars } from './summary-charts';
import './overview.css';

type Props = { onOpenHotspot: (type: ReportType, location: Coordinates) => void };

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'danger';
}) {
  return (
    <div className={`kpi${tone ? ` kpi-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-hint">{hint}</span>
    </div>
  );
}

export function OverviewScreen({ onOpenHotspot }: Props) {
  const summary = useSummary();

  if (summary.isPending)
    return (
      <div className="overview overview-state" aria-busy="true">
        <div className="spinner" role="status" aria-label="Carregando visão geral" />
      </div>
    );
  if (summary.isError)
    return (
      <div className="overview overview-state">
        <p className="notice notice-error" role="alert">
          {summary.error.message}
        </p>
        <button type="button" className="btn" onClick={() => void summary.refetch()}>
          Tentar de novo
        </button>
      </div>
    );

  const { counts, averageResolutionHours, openByType, daily, hotspots } = summary.data;
  const total = counts.open + counts.resolved + counts.dismissed;
  return (
    <div className="overview">
      <header className="overview-head">
        <div>
          <h1>Visão geral</h1>
          <p className="muted small">
            Todos os relatos enviados ao painel pelo app · atualizado às{' '}
            {formatClock(new Date(summary.data.generatedAt))}
          </p>
        </div>
      </header>

      {total === 0 ? (
        <p className="notice">
          Ainda não chegou nenhum relato. Quando alguém enviar um problema da cidade ao painel pelo
          app, os números aparecem aqui.
        </p>
      ) : null}

      <div className="kpis">
        <Kpi
          label="Em aberto"
          value={counts.open.toLocaleString('pt-BR')}
          hint="Aguardando solução"
        />
        <Kpi
          label="Prioridade alta"
          value={counts.highPriorityOpen.toLocaleString('pt-BR')}
          hint="Entre os em aberto"
          tone={counts.highPriorityOpen > 0 ? 'danger' : undefined}
        />
        <Kpi
          label="Novos em 24 h"
          value={counts.receivedLast24h.toLocaleString('pt-BR')}
          hint="Recebidos pelo app"
        />
        <Kpi
          label="Resolvidos em 7 dias"
          value={counts.resolvedLast7d.toLocaleString('pt-BR')}
          hint="Encerrados pela equipe"
        />
        <Kpi
          label="Tempo até resolver"
          value={averageResolutionHours === null ? '—' : formatDuration(averageResolutionHours)}
          hint={
            averageResolutionHours === null ? 'Sem casos resolvidos ainda' : 'Média dos resolvidos'
          }
        />
      </div>

      <div className="overview-grid">
        <section className="card" aria-labelledby="status-title">
          <h2 id="status-title">Por andamento</h2>
          <StatusBar counts={counts} />
        </section>
        <section className="card" aria-labelledby="type-title">
          <h2 id="type-title">Em aberto por tipo</h2>
          {openByType.length === 0 ? (
            <p className="muted small">Nenhum relato em aberto.</p>
          ) : (
            <TypeBars rows={openByType} />
          )}
        </section>
        <section className="card card-wide" aria-labelledby="daily-title">
          <h2 id="daily-title">Recebidos e resolvidos por dia</h2>
          <DailyChart days={daily} />
        </section>
        <section className="card card-wide" aria-labelledby="hotspot-title">
          <h2 id="hotspot-title">Pontos críticos</h2>
          <p className="muted small">
            Lugares com dois ou mais relatos em aberto do mesmo tipo, em um quarteirão. Quem foi
            relatado mais vezes merece a vistoria primeiro.
          </p>
          {hotspots.length === 0 ? (
            <p className="muted small hotspot-empty">Nenhum ponto com relatos repetidos agora.</p>
          ) : (
            <ol className="hotspots">
              {hotspots.map((spot) => (
                <li key={`${spot.type}-${spot.location.latitude}-${spot.location.longitude}`}>
                  <TypeBadge type={spot.type} />
                  <div className="hotspot-body">
                    <strong>
                      {reportLabels[spot.type]} · {spot.count} relatos em aberto
                    </strong>
                    <span className="muted small">
                      {spot.address} · o mais antigo {formatAge(spot.oldestAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onOpenHotspot(spot.type, spot.location)}
                  >
                    Ver na fila
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <p className="muted small overview-foot">
        Andamentos possíveis: {Object.values(governmentStatusLabels).join(', ')}. Prioridade é uma
        sugestão por regra fixa, sem classificação oficial.
      </p>
    </div>
  );
}
