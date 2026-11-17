import { useEffect, useRef } from 'react';
import { governmentStatusLabels, reportLabels, reportPriorityLabels } from '@safewalk/contracts';
import type { AdminReportItem } from '@safewalk/contracts';
import { formatAge } from '../../shared/format';
import { Icon } from '../../shared/icons';
import { TypeBadge } from '../../shared/report-types';

type Props = {
  items: readonly AdminReportItem[];
  selectedId: string | null;
  /** Relatos que acabaram de chegar: entram no topo, com destaque por alguns segundos. */
  freshIds: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (id: string) => void;
};

function ReportRow({
  item,
  selected,
  fresh,
  onSelect,
}: {
  item: AdminReportItem;
  selected: boolean;
  fresh: boolean;
  onSelect: (id: string) => void;
}) {
  const open = item.status !== 'resolved' && item.status !== 'dismissed';
  const row = useRef<HTMLLIElement>(null);
  // Aberto pelo mapa ou por um aviso, o relato aparece na lista sem precisar procurar.
  useEffect(() => {
    if (selected) row.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  // Relato recém-chegado entra no topo: a lista sobe para ele ser visto chegando.
  useEffect(() => {
    if (!fresh) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  }, [fresh]);
  return (
    <li ref={row} className={fresh ? 'report-item is-fresh' : 'report-item'}>
      <button
        type="button"
        className={`report-row priority-${item.priority}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(item.id)}
      >
        <TypeBadge type={item.type} />
        <span className="report-row-body">
          <span className="report-row-top">
            <strong className="report-row-address">{item.address}</strong>
            {fresh ? (
              <span className="report-row-new">Novo</span>
            ) : (
              <span className="report-row-age num">{formatAge(item.createdAt)}</span>
            )}
          </span>
          <span className="report-row-sub">
            <span className="report-row-type">{reportLabels[item.type]}</span>
            <span className={`pill status-${item.status}`}>
              {governmentStatusLabels[item.status]}
            </span>
          </span>
          {(item.priority !== 'normal' ||
            item.nearbyCount > 1 ||
            item.hasPhoto ||
            (item.authorResolved && open)) && (
            <span className="report-row-meta">
              {item.priority !== 'normal' && (
                <span className={`meta meta-priority priority-${item.priority}`}>
                  <Icon name="flag" />
                  Prioridade {reportPriorityLabels[item.priority].toLowerCase()}
                </span>
              )}
              {item.nearbyCount > 1 && (
                <span className="meta">
                  <Icon name="stack" />
                  {item.nearbyCount} no mesmo ponto
                </span>
              )}
              {item.hasPhoto && (
                <span className="meta">
                  <Icon name="camera" />
                  Foto
                </span>
              )}
              {item.authorResolved && open && (
                <span className="meta meta-attention">Autor diz que passou</span>
              )}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function ReportList({
  items,
  selectedId,
  freshIds,
  loading,
  error,
  onRetry,
  onSelect,
}: Props) {
  if (loading)
    return (
      <div className="list-state" aria-busy="true">
        <div className="spinner" role="status" aria-label="Carregando relatos" />
        <p className="muted small">Buscando os relatos da fila…</p>
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
        <span className="list-empty-mark" aria-hidden="true">
          <Icon name="check" />
        </span>
        <p className="list-empty-title">Nenhum relato nesta fila</p>
        <p className="muted small">
          Quando alguém enviar um buraco, semáforo ou outro problema pelo app, ele aparece aqui.
        </p>
      </div>
    );
  return (
    <ul className="report-list scroll">
      {items.map((item) => (
        <ReportRow
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          fresh={freshIds.has(item.id)}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
