import { governmentStatusLabels, reportLabels, reportPriorityLabels } from '@safewalk/contracts';
import type { AdminReportItem } from '@safewalk/contracts';
import { formatAge } from '../../shared/format';
import { TypeBadge } from '../../shared/report-types';

type Props = {
  items: readonly AdminReportItem[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (id: string) => void;
};

export function ReportList({ items, selectedId, loading, error, onRetry, onSelect }: Props) {
  if (loading)
    return (
      <div className="list-state" aria-busy="true">
        <div className="spinner" role="status" aria-label="Carregando relatos" />
      </div>
    );
  if (error)
    return (
      <div className="list-state">
        <p className="notice notice-error" role="alert">
          {error}
        </p>
        <button type="button" className="btn" onClick={onRetry}>
          Tentar de novo
        </button>
      </div>
    );
  if (items.length === 0)
    return (
      <div className="list-state">
        <p className="list-empty-title">Nenhum relato nesta fila</p>
        <p className="muted small">
          Quando alguém enviar um buraco, semáforo ou outro problema pelo app, ele aparece aqui.
        </p>
      </div>
    );
  return (
    <ul className="report-list">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="report-row"
            aria-current={selectedId === item.id ? 'true' : undefined}
            onClick={() => onSelect(item.id)}
          >
            <TypeBadge type={item.type} />
            <span className="report-row-body">
              <span className="report-row-title">
                <strong>{reportLabels[item.type]}</strong>
                <span className="muted small">{formatAge(item.createdAt)}</span>
              </span>
              <span className="report-row-address">{item.address}</span>
              <span className="report-row-tags">
                <span className={`pill status-${item.status}`}>
                  {governmentStatusLabels[item.status]}
                </span>
                {item.priority !== 'normal' && (
                  <span className={`pill priority-${item.priority}`}>
                    <span className="dot" aria-hidden="true" />
                    Prioridade {reportPriorityLabels[item.priority].toLowerCase()}
                  </span>
                )}
                {item.nearbyCount > 1 && (
                  <span className="pill">{item.nearbyCount} no mesmo ponto</span>
                )}
                {item.hasPhoto && <span className="pill">Foto</span>}
                {item.authorResolved && item.status !== 'resolved' && (
                  <span className="pill priority-medium">Autor diz que passou</span>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
