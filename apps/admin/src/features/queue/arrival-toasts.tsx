import { useState } from 'react';
import { reportLabels } from '@safewalk/contracts';
import { Icon } from '../../shared/icons';
import { TypeBadge } from '../../shared/report-types';
import { useNow } from '../../shared/use-now';
import type { Arrival } from './use-arrivals';

const TOAST_MS = 9_000;
const MAX_TOASTS = 3;

type Props = { arrivals: readonly Arrival[]; onOpen: (id: string) => void };

/** Aviso de relato recém-chegado; some sozinho e pode abrir o relato no mapa. */
export function ArrivalToasts({ arrivals, onOpen }: Props) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const now = useNow(1_000, arrivals.length > 0);
  const visible = arrivals
    .filter((arrival) => now - arrival.at < TOAST_MS && !dismissed.has(arrival.id))
    .slice(0, MAX_TOASTS);
  const dismiss = (id: string) => setDismissed((current) => new Set(current).add(id));

  return (
    <div className="toasts" role="status" aria-live="polite">
      {visible.map((arrival) => (
        <div key={arrival.id} className="toast float">
          <TypeBadge type={arrival.type} />
          <p className="toast-body">
            <strong>Novo relato recebido</strong>
            <span>
              {reportLabels[arrival.type]}, {arrival.address}
            </span>
          </p>
          <button
            type="button"
            className="btn toast-open"
            onClick={() => {
              onOpen(arrival.id);
              dismiss(arrival.id);
            }}
          >
            Abrir
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            aria-label="Dispensar aviso"
            onClick={() => dismiss(arrival.id)}
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  );
}
