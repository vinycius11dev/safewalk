import { governmentStatusLabels, reportLabels, reportPriorityLabels } from '@safewalk/contracts';
import type { AdminReportDetail, AdminReportItem, AdminRole } from '@safewalk/contracts';
import { useReportDetail, useReportPhoto } from '../../api/queries';
import { formatAge, formatDateTime } from '../../shared/format';
import { priorityReasons } from '../../shared/priority-reasons';
import { TypeBadge } from '../../shared/report-types';
import { StatusForm } from './status-form';

type Props = {
  id: string;
  /** Dados da lista, mostrados na hora enquanto o detalhe (com histórico) chega. */
  preview: AdminReportItem | undefined;
  role: AdminRole;
  onClose: () => void;
};

function mapLink({ latitude, longitude }: AdminReportItem['location']): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;
}

export function ReportDetail({ id, preview, role, onClose }: Props) {
  const detail = useReportDetail(id);
  const item: AdminReportItem | AdminReportDetail | undefined = detail.data ?? preview;
  const photo = useReportPhoto(id, Boolean(item?.hasPhoto));

  if (!item)
    return (
      <div className="detail">
        <button type="button" className="btn btn-quiet detail-close" onClick={onClose}>
          Fechar
        </button>
        {detail.isError ? (
          <p className="notice notice-error" role="alert">
            {detail.error.message}
          </p>
        ) : (
          <div className="list-state" aria-busy="true">
            <div className="spinner" role="status" aria-label="Carregando relato" />
          </div>
        )}
      </div>
    );

  const reasons = priorityReasons(item);
  const events = detail.data?.events ?? [];
  return (
    <article className="detail">
      <header className="detail-head">
        <TypeBadge type={item.type} />
        <div>
          <h2>{reportLabels[item.type]}</h2>
          <p className="muted small">
            Recebido {formatDateTime(item.createdAt)} · {formatAge(item.createdAt)}
          </p>
        </div>
        <button type="button" className="btn btn-quiet detail-close" onClick={onClose}>
          Fechar
        </button>
      </header>

      <div className="detail-tags">
        <span className={`pill status-${item.status}`}>{governmentStatusLabels[item.status]}</span>
        <span className={`pill priority-${item.priority}`}>
          <span className="dot" aria-hidden="true" />
          Prioridade {reportPriorityLabels[item.priority].toLowerCase()}
        </span>
      </div>

      {item.hasPhoto && (
        <figure className="detail-photo">
          {photo.url ? (
            <img src={photo.url} alt={`Foto enviada no relato: ${reportLabels[item.type]}`} />
          ) : photo.isError ? (
            <p className="notice notice-error">Não foi possível carregar a foto.</p>
          ) : (
            <div className="detail-photo-loading" aria-busy="true">
              <div className="spinner" role="status" aria-label="Carregando foto" />
            </div>
          )}
          <figcaption className="muted small">
            Foto enviada por quem relatou, sem dados de localização do arquivo.
          </figcaption>
        </figure>
      )}

      <section className="detail-block">
        <h3>O que foi relatado</h3>
        <p>{item.description || 'Sem descrição.'}</p>
      </section>

      <section className="detail-block">
        <h3>Local</h3>
        <p>{item.address}</p>
        <p className="muted small">
          {item.location.latitude.toFixed(6)}, {item.location.longitude.toFixed(6)} ·{' '}
          <a href={mapLink(item.location)} target="_blank" rel="noreferrer">
            Abrir no OpenStreetMap
          </a>
        </p>
      </section>

      <section className="detail-block">
        <h3>Por que esta prioridade</h3>
        {reasons.length > 0 ? (
          <ul className="reasons">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Relato isolado e recente: nenhum fator de urgência extra.</p>
        )}
        <p className="muted small">
          Sugestão por regra fixa, só para ordenar a fila. Não é classificação oficial e não
          substitui a avaliação da equipe.
        </p>
        {item.authorResolved && item.status !== 'resolved' && (
          <p className="notice small">
            Quem relatou avisou que o problema passou. Confirme em campo antes de encerrar.
          </p>
        )}
      </section>

      {role === 'operator' ? (
        <StatusForm key={`${item.id}-${item.status}`} id={item.id} current={item.status} />
      ) : (
        <p className="notice small">Seu perfil é de consulta: só operadores mudam o andamento.</p>
      )}

      <section className="detail-block">
        <h3>Histórico</h3>
        {events.length === 0 ? (
          <p className="muted small">Carregando histórico…</p>
        ) : (
          <ol className="timeline">
            {events.map((event) => (
              <li key={event.id}>
                <p>
                  <strong>
                    {event.fromStatus
                      ? `${governmentStatusLabels[event.fromStatus]} → ${governmentStatusLabels[event.toStatus]}`
                      : governmentStatusLabels[event.toStatus]}
                  </strong>
                </p>
                {event.note && <p>{event.note}</p>}
                <p className="muted small">
                  {event.adminName ?? 'App SafeWalk'} · {formatDateTime(event.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
