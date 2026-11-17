import { useEffect, useRef, useState } from 'react';
import { governmentStatusLabels, reportLabels, reportPriorityLabels } from '@safewalk/contracts';
import type {
  AdminReportDetail,
  AdminReportEvent,
  AdminReportItem,
  AdminRole,
} from '@safewalk/contracts';
import { useReportDetail, useReportPhoto } from '../../api/queries';
import { formatAge, formatDateTime } from '../../shared/format';
import { Icon } from '../../shared/icons';
import { priorityReasons } from '../../shared/priority-reasons';
import { TypeBadge } from '../../shared/report-types';
import { CaseTrack } from './case-track';
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

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-quiet btn-icon detail-close"
      aria-label="Fechar detalhe"
      onClick={onClose}
    >
      <Icon name="close" />
    </button>
  );
}

/** Histórico do caso em linha do tempo, do mais recente para o mais antigo. */
function CaseHistory({ events, failed }: { events: readonly AdminReportEvent[]; failed: boolean }) {
  const section = useRef<HTMLElement>(null);
  const seenCount = useRef<number | null>(null);
  const [newId, setNewId] = useState<number | null>(null);

  // Andamento recém-registrado: traz o histórico à vista e acende o item novo.
  useEffect(() => {
    if (events.length === 0) return;
    const grew = seenCount.current !== null && events.length > seenCount.current;
    seenCount.current = events.length;
    if (!grew) return;
    setNewId(events[0]?.id ?? null);
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  }, [events]);

  return (
    <section ref={section} className="detail-block">
      <h3>Histórico</h3>
      {events.length === 0 ? (
        <p className="muted small">
          {failed ? 'Não foi possível carregar o histórico.' : 'Carregando histórico…'}
        </p>
      ) : (
        <ol className="timeline">
          {events.map((event) => (
            <li
              key={event.id}
              className={`status-${event.toStatus}${event.id === newId ? ' is-new' : ''}`}
            >
              <p className="timeline-title">
                <strong>
                  {event.fromStatus
                    ? `${governmentStatusLabels[event.fromStatus]} → ${governmentStatusLabels[event.toStatus]}`
                    : governmentStatusLabels[event.toStatus]}
                </strong>
              </p>
              {event.note && <p className="timeline-note">{event.note}</p>}
              <p className="muted small">
                {event.adminName ? `Por ${event.adminName}` : 'Pelo app SafeWalk'} em{' '}
                {formatDateTime(event.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ReportDetail({ id, preview, role, onClose }: Props) {
  const detail = useReportDetail(id);
  const item: AdminReportItem | AdminReportDetail | undefined = detail.data ?? preview;
  const photo = useReportPhoto(id, Boolean(item?.hasPhoto));

  if (!item)
    return (
      <div className="detail">
        <div className="detail-top">
          <header className="detail-head">
            <div>
              <h2>Relato</h2>
            </div>
            <CloseButton onClose={onClose} />
          </header>
        </div>
        <div className="detail-body">
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
      </div>
    );

  const reasons = priorityReasons(item);
  const events = detail.data?.events ?? [];
  const visited = detail.data ? new Set(events.map((event) => event.toStatus)) : undefined;
  return (
    <article className="detail">
      <div className="detail-top">
        <header className="detail-head">
          <TypeBadge type={item.type} />
          <div>
            <h2>{reportLabels[item.type]}</h2>
            <p className="muted small">
              Recebido em {formatDateTime(item.createdAt)} ({formatAge(item.createdAt)})
            </p>
          </div>
          <CloseButton onClose={onClose} />
        </header>
        <CaseTrack status={item.status} visited={visited} />
      </div>

      <div className="detail-body scroll">
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
          <p className="detail-quote">{item.description || 'Sem descrição.'}</p>
        </section>

        <section className="detail-block">
          <h3>Local</h3>
          <p className="detail-place">
            <Icon name="pin" />
            <span>{item.address}</span>
          </p>
          <p className="muted small detail-coords">
            <span className="num">
              {item.location.latitude.toFixed(6)}, {item.location.longitude.toFixed(6)}
            </span>
            <a href={mapLink(item.location)} target="_blank" rel="noreferrer">
              Abrir no OpenStreetMap
              <Icon name="external" />
            </a>
          </p>
        </section>

        <section className="detail-block">
          <h3>
            Por que esta prioridade
            <span className={`pill priority-${item.priority}`}>
              <span className="dot" aria-hidden="true" />
              {reportPriorityLabels[item.priority]}
            </span>
          </h3>
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
            <p className="notice notice-attention small">
              Quem relatou avisou que o problema passou. Confirme em campo antes de encerrar.
            </p>
          )}
        </section>

        {role === 'operator' ? (
          <StatusForm key={`${item.id}-${item.status}`} id={item.id} current={item.status} />
        ) : (
          <p className="notice small">Seu perfil é de consulta: só operadores mudam o andamento.</p>
        )}

        <CaseHistory events={events} failed={detail.isError} />
      </div>
    </article>
  );
}
