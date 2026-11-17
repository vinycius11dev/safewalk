import { governmentReportTypes, reportLabels } from '@safewalk/contracts';
import type { AdminReportListQuery } from '@safewalk/contracts';
import { Icon } from '../../shared/icons';

const statusOptions: { value: AdminReportListQuery['status']; label: string }[] = [
  { value: 'open', label: 'Em aberto' },
  { value: 'received', label: 'Recebidos' },
  { value: 'analyzing', label: 'Em análise' },
  { value: 'dispatched', label: 'Equipe acionada' },
  { value: 'resolved', label: 'Resolvidos' },
  { value: 'dismissed', label: 'Arquivados' },
  { value: 'all', label: 'Todos' },
];

type Props = {
  status: AdminReportListQuery['status'];
  type: AdminReportListQuery['type'];
  search: string;
  onStatus: (status: AdminReportListQuery['status']) => void;
  onType: (type: AdminReportListQuery['type']) => void;
  onSearch: (search: string) => void;
};

export function ReportFilters({ status, type, search, onStatus, onType, onSearch }: Props) {
  return (
    <div className="filters">
      <div className="filter-row">
        <label className="filter-search">
          <span className="sr-only">Buscar por endereço ou descrição</span>
          <Icon name="search" />
          <input
            className="input"
            type="search"
            placeholder="Buscar endereço ou descrição"
            value={search}
            maxLength={80}
            onChange={(event) => onSearch(event.target.value)}
          />
        </label>
        <label className="filter-type">
          <span className="sr-only">Tipo de relato</span>
          <select
            className="input"
            value={type ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              onType(governmentReportTypes.find((candidate) => candidate === value));
            }}
          >
            <option value="">Todos os tipos</option>
            {governmentReportTypes.map((value) => (
              <option key={value} value={value}>
                {reportLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="filter-tabs" role="group" aria-label="Andamento">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={status === option.value}
            onClick={() => onStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
