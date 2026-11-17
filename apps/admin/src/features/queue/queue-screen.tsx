import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdminReportListQuery, AdminRole } from '@safewalk/contracts';
import { useReports } from '../../api/queries';
import type { QueueFocus } from '../../shell';
import { reportsToCsv } from '../../shared/csv';
import { Icon } from '../../shared/icons';
import { useMediaQuery } from '../../shared/use-media-query';
import { ArrivalToasts } from './arrival-toasts';
import { KpiStrip } from './kpi-strip';
import { LiveIndicator } from './live-indicator';
import { ReportDetail } from './report-detail';
import { ReportFilters } from './report-filters';
import { ReportList } from './report-list';
import type { MapInsets } from './report-map';
import { useArrivals } from './use-arrivals';
import './queue.css';

/** O mapa pesa mais de 1 MB: só é baixado quando a fila abre, não na tela de entrada. */
const ReportMap = lazy(() =>
  import('./report-map').then((module) => ({ default: module.ReportMap })),
);

const SEARCH_DELAY_MS = 300;
/** Folga entre um painel flutuante e a área útil do mapa. */
const MAP_MARGIN = 28;
const NO_INSETS: MapInsets = { top: 0, right: 0, bottom: 0, left: 0 };

const statusCaptions: Record<AdminReportListQuery['status'], string> = {
  open: 'em aberto',
  received: 'recebidos, sem análise',
  analyzing: 'em análise',
  dispatched: 'com equipe acionada',
  resolved: 'resolvidos',
  dismissed: 'arquivados',
  all: 'no total',
};

function downloadCsv(csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatos-painel-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function QueueScreen({ role, focus }: { role: AdminRole; focus: QueueFocus | null }) {
  const [status, setStatus] = useState<AdminReportListQuery['status']>('open');
  const [type, setType] = useState<AdminReportListQuery['type']>(focus?.type);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  /** Em tela larga os painéis flutuam sobre o mapa; em tela estreita viram folhas inteiras. */
  const floating = useMediaQuery('(min-width: 900px)');
  const frame = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLElement>(null);
  const center = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo<AdminReportListQuery>(
    () => ({ status, type, q: search || undefined, days: undefined }),
    [status, type, search],
  );
  const reports = useReports(query);
  const items = useMemo(() => reports.data?.items ?? [], [reports.data]);
  /** Só vale quando a resposta já é a destes filtros (e não a anterior, mantida na tela). */
  const settledKey = reports.data && !reports.isPlaceholderData ? JSON.stringify(query) : null;
  const arrivals = useArrivals(settledKey, items);
  const freshIds = useMemo(() => new Set(arrivals.map((arrival) => arrival.id)), [arrivals]);
  const ordered = useMemo(
    () =>
      freshIds.size === 0
        ? items
        : [
            ...items.filter((item) => freshIds.has(item.id)),
            ...items.filter((item) => !freshIds.has(item.id)),
          ],
    [items, freshIds],
  );
  const selected = items.find((item) => item.id === selectedId);
  const total = reports.data?.total ?? 0;

  /** Área do mapa que não está coberta pelos painéis, medida na tela. */
  const measureInsets = useCallback((): MapInsets => {
    const root = frame.current;
    if (!floating || !root) return NO_INSETS;
    // A faixa de indicadores é o primeiro filho; os avisos abaixo dela são passageiros.
    const strip = center.current?.firstElementChild;
    const stripBottom =
      center.current && strip instanceof HTMLElement
        ? center.current.offsetTop + strip.offsetHeight
        : 0;
    return {
      top: stripBottom + MAP_MARGIN,
      left: rail.current ? rail.current.offsetLeft + rail.current.offsetWidth + MAP_MARGIN : 0,
      right: drawer.current
        ? root.clientWidth - drawer.current.offsetLeft + MAP_MARGIN
        : MAP_MARGIN,
      bottom: MAP_MARGIN,
    };
  }, [floating]);

  const openReport = (id: string) => {
    setSelectedId(id);
    setView('map');
  };

  return (
    <div
      ref={frame}
      className="queue"
      data-view={view}
      data-detail={selectedId ? 'open' : 'closed'}
    >
      <div className="queue-toggle" role="group" aria-label="Alternar entre lista e mapa">
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
          <Icon name="list" />
          Lista
        </button>
        <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
          <Icon name="map" />
          Mapa
        </button>
      </div>

      <section ref={rail} className="queue-rail float" aria-label="Relatos">
        <header className="rail-head">
          <p className="rail-count" aria-live="polite">
            {reports.data ? (
              <>
                <strong className="num">{total.toLocaleString('pt-BR')}</strong>
                <span>
                  {total === 1 ? 'relato' : 'relatos'} {statusCaptions[status]}
                </span>
              </>
            ) : (
              <span>Fila de relatos</span>
            )}
          </p>
          <LiveIndicator updatedAt={reports.dataUpdatedAt} failing={reports.isRefetchError} />
        </header>
        <ReportFilters
          status={status}
          type={type}
          search={searchInput}
          onStatus={setStatus}
          onType={setType}
          onSearch={setSearchInput}
        />
        <ReportList
          items={ordered}
          selectedId={selectedId}
          freshIds={freshIds}
          loading={reports.isPending}
          error={reports.isError && !reports.data ? reports.error.message : null}
          onRetry={() => void reports.refetch()}
          onSelect={openReport}
        />
        <footer className="rail-foot">
          <span>
            {reports.data?.truncated
              ? `Mostrando os ${items.length} mais urgentes`
              : 'Em ordem de prioridade sugerida'}
          </span>
          <button
            type="button"
            className="btn btn-quiet"
            disabled={items.length === 0}
            onClick={() => downloadCsv(reportsToCsv(items))}
          >
            <Icon name="download" />
            Exportar CSV
          </button>
        </footer>
      </section>

      <div ref={center} className="queue-center">
        <KpiStrip />
        <ArrivalToasts arrivals={arrivals} onOpen={openReport} />
      </div>

      <section className="queue-map" aria-label="Mapa dos relatos">
        <Suspense
          fallback={
            <div className="list-state" aria-busy="true">
              <div className="spinner" role="status" aria-label="Carregando mapa" />
            </div>
          }
        >
          <ReportMap
            items={items}
            selectedId={selectedId}
            freshIds={freshIds}
            viewKey={settledKey}
            layoutKey={`${floating}-${selectedId !== null}`}
            measureInsets={measureInsets}
            target={focus?.location ?? null}
            onSelect={setSelectedId}
          />
        </Suspense>
      </section>

      {selectedId && (
        <aside ref={drawer} className="queue-drawer float" aria-label="Detalhe do relato">
          <ReportDetail
            key={selectedId}
            id={selectedId}
            preview={selected}
            role={role}
            onClose={() => setSelectedId(null)}
          />
        </aside>
      )}
    </div>
  );
}
