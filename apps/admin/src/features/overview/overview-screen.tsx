import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import type { Coordinates, ReportType } from '@safewalk/contracts';
import { useSummary } from '../../api/queries';
import { formatAge, formatClock, formatDay, formatDuration } from '../../shared/format';
import { Icon } from '../../shared/icons';
import { TypeBadge } from '../../shared/report-types';
import { DailyChart } from './daily-chart';
import { StatusDonut, TypeBars } from './summary-charts';
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
  tone?: 'alert';
}) {
  return (
    <li className={`kpi${tone ? ` kpi-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value num">{value}</strong>
      <span className="kpi-hint">{hint}</span>
    </li>
  );
}

export function OverviewScreen({ onOpenHotspot }: Props) {
  const summary = useSummary();

  if (!summary.data)
    return summary.isError ? (
      <div className="overview overview-state">
        <p className="notice notice-error" role="alert">
          {summary.error.message}
        </p>
        <button type="button" className="btn" onClick={() => void summary.refetch()}>
          Tentar de novo
        </button>
      </div>
    ) : (
      <div className="overview overview-state" aria-busy="true">
        <div className="spinner" role="status" aria-label="Carregando visão geral" />
        <p className="muted small">Somando os relatos…</p>
      </div>
    );

  const { counts, averageResolutionHours, openByType, daily, hotspots } = summary.data;
  const total = counts.open + counts.resolved + counts.dismissed;
  const receivedInPeriod = daily.reduce((sum, day) => sum + day.received, 0);
  const resolvedInPeriod = daily.reduce((sum, day) => sum + day.resolved, 0);
  const firstDay = daily[0];
  const lastDay = daily[daily.length - 1];
  return (
    <div className="overview scroll">
      <div className="overview-inner">
        <header className="overview-head">
          <div>
            <h1>Visão geral</h1>
            <p className="muted">Todos os relatos que as pessoas enviaram ao painel pelo app.</p>
          </div>
          <p className="overview-stamp num">
            <Icon name="clock" />
            Atualizado às {formatClock(new Date(summary.data.generatedAt))}
          </p>
        </header>

        {total === 0 ? (
          <p className="notice">
            Ainda não chegou nenhum relato. Quando alguém enviar um problema da cidade ao painel
            pelo app, os números aparecem aqui.
          </p>
        ) : null}

        <ul className="kpis" aria-label="Indicadores">
          <Kpi
            label="Em aberto"
            value={counts.open.toLocaleString('pt-BR')}
            hint="Aguardando solução"
          />
          <Kpi
            label="Prioridade alta"
            value={counts.highPriorityOpen.toLocaleString('pt-BR')}
            hint="Entre os em aberto"
            tone={counts.highPriorityOpen > 0 ? 'alert' : undefined}
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
              averageResolutionHours === null
                ? 'Sem casos resolvidos ainda'
                : 'Média dos resolvidos'
            }
          />
        </ul>

        <div className="overview-grid">
          <section className="card card-daily" aria-labelledby="daily-title">
            <header className="card-head">
              <div>
                <h2 id="daily-title">Recebidos e resolvidos por dia</h2>
                {firstDay && lastDay && (
                  <p className="muted small">
                    De {formatDay(firstDay.date)} a {formatDay(lastDay.date)}
                  </p>
                )}
              </div>
              <ul className="legend">
                <li>
                  <span className="key key-received" aria-hidden="true" />
                  Recebidos
                  <strong className="num">{receivedInPeriod.toLocaleString('pt-BR')}</strong>
                </li>
                <li>
                  <span className="key key-resolved" aria-hidden="true" />
                  Resolvidos
                  <strong className="num">{resolvedInPeriod.toLocaleString('pt-BR')}</strong>
                </li>
              </ul>
            </header>
            <DailyChart days={daily} />
          </section>

          <section className="card card-status" aria-labelledby="status-title">
            <header className="card-head">
              <h2 id="status-title">Por andamento</h2>
            </header>
            <StatusDonut counts={counts} />
          </section>

          <section className="card card-types" aria-labelledby="type-title">
            <header className="card-head">
              <h2 id="type-title">Em aberto por tipo</h2>
            </header>
            {openByType.length === 0 ? (
              <p className="muted small card-empty">Nenhum relato em aberto.</p>
            ) : (
              <TypeBars rows={openByType} />
            )}
          </section>

          <section className="card card-hotspots" aria-labelledby="hotspot-title">
            <header className="card-head">
              <div>
                <h2 id="hotspot-title">Pontos críticos</h2>
                <p className="muted small">
                  Lugares com dois ou mais relatos em aberto do mesmo tipo, em um quarteirão. Quem
                  foi relatado mais vezes merece a vistoria primeiro.
                </p>
              </div>
            </header>
            {hotspots.length === 0 ? (
              <p className="muted small card-empty">Nenhum ponto com relatos repetidos agora.</p>
            ) : (
              <ol className="hotspots">
                {hotspots.map((spot, index) => (
                  <li key={`${spot.type}-${spot.location.latitude}-${spot.location.longitude}`}>
                    <button
                      type="button"
                      className="hotspot"
                      onClick={() => onOpenHotspot(spot.type, spot.location)}
                    >
                      <span className="hotspot-rank num" aria-hidden="true">
                        {index + 1}
                      </span>
                      <TypeBadge type={spot.type} />
                      <span className="hotspot-body">
                        <strong>{spot.address}</strong>
                        <span className="muted small">
                          {reportLabels[spot.type]}, o mais antigo chegou {formatAge(spot.oldestAt)}
                        </span>
                      </span>
                      <span className="hotspot-count">
                        <strong className="num">{spot.count}</strong>
                        <span>em aberto</span>
                      </span>
                      <span className="hotspot-go">
                        Ver no mapa
                        <Icon name="chevron-right" />
                      </span>
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
    </div>
  );
}
