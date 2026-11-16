import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { AdminReportListQuery, AdminRole } from '@safewalk/contracts';
import { useReports } from '../../api/queries';
import type { QueueFocus } from '../../shell';
import { reportsToCsv } from '../../shared/csv';
import { formatClock } from '../../shared/format';
import { ReportDetail } from './report-detail';
import { ReportFilters } from './report-filters';
import { ReportList } from './report-list';
import './queue.css';

/** O mapa pesa mais de 1 MB: só é baixado quando a fila abre, não na tela de entrada. */
const ReportMap = lazy(() =>
  import('./report-map').then((module) => ({ default: module.ReportMap })),
);

const SEARCH_DELAY_MS = 300;

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
  const selected = items.find((item) => item.id === selectedId);

  return (
    <div className="queue" data-view={view} data-detail={selectedId ? 'open' : 'closed'}>
      <div className="queue-toggle" role="group" aria-label="Alternar entre lista e mapa">
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
          Lista
        </button>
        <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
          Mapa
        </button>
      </div>
      <section className="queue-list" aria-label="Relatos">
        <ReportFilters
          status={status}
          type={type}
          search={searchInput}
          onStatus={setStatus}
          onType={setType}
          onSearch={setSearchInput}
        />
        <div className="queue-meta">
          <span aria-live="polite">
            {reports.data
              ? `${reports.data.total.toLocaleString('pt-BR')} ${reports.data.total === 1 ? 'relato' : 'relatos'}${reports.data.truncated ? ` · mostrando os ${items.length} mais urgentes` : ''}`
              : ' '}
          </span>
          <span className="queue-meta-actions">
            {reports.dataUpdatedAt > 0 && (
              <span title="A fila se atualiza sozinha a cada 30 segundos">
                {reports.isFetching
                  ? 'Atualizando…'
                  : `Atualizado ${formatClock(new Date(reports.dataUpdatedAt))}`}
              </span>
            )}
            <button
              type="button"
              className="btn btn-quiet"
              disabled={items.length === 0}
              onClick={() => downloadCsv(reportsToCsv(items))}
            >
              Exportar CSV
            </button>
          </span>
        </div>
        <ReportList
          items={items}
          selectedId={selectedId}
          loading={reports.isPending}
          error={reports.isError ? reports.error.message : null}
          onRetry={() => void reports.refetch()}
          onSelect={(id) => {
            setSelectedId(id);
            setView('map');
          }}
        />
      </section>
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
            target={focus?.location ?? null}
            onSelect={setSelectedId}
          />
        </Suspense>
      </section>
      {selectedId && (
        <aside className="queue-detail" aria-label="Detalhe do relato">
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
