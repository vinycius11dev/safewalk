import { useEffect, useState } from 'react';
import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import type { GovernmentStatus, ReportType } from '@safewalk/contracts';
import { TypeBadge } from '../../shared/report-types';

type Example = {
  type: ReportType;
  place: string;
  status: GovernmentStatus;
  high?: boolean;
};

/** Exemplos ilustrativos (não são relatos reais), no formato em que chegam à fila. */
const EXAMPLES: readonly Example[] = [
  { type: 'pothole', place: 'Rua Treze de Maio, Bela Vista', status: 'received', high: true },
  { type: 'traffic_light', place: 'Av. Paulista com R. da Consolação', status: 'dispatched' },
  { type: 'lighting', place: 'Rua Frei Caneca, Consolação', status: 'analyzing' },
  { type: 'flood', place: 'Av. Nove de Julho, Bela Vista', status: 'received', high: true },
  { type: 'sidewalk', place: 'Rua Augusta, Cerqueira César', status: 'resolved' },
  { type: 'obstruction', place: 'Rua Rui Barbosa, Bela Vista', status: 'analyzing' },
];
const VISIBLE = 3;
const INTERVAL_MS = 3200;

/** Feed de exemplo: um relato novo entra no topo a cada poucos segundos. */
export function LiveTicker() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const items = Array.from({ length: VISIBLE }, (_, offset) => {
    const position = tick - offset;
    const example = EXAMPLES[((position % EXAMPLES.length) + EXAMPLES.length) % EXAMPLES.length];
    return { key: position, example };
  });

  return (
    <section className="ticker" aria-label="Exemplos de relatos (ilustração)">
      <p className="ticker-head">
        <span className="ticker-dot" aria-hidden="true" />
        Exemplos de relatos chegando à fila
      </p>
      <ol className="ticker-list">
        {items.map(({ key, example }, index) =>
          example ? (
            <li key={key} className={`ticker-item ticker-pos-${index}`}>
              <TypeBadge type={example.type} />
              <div className="ticker-text">
                <strong>{reportLabels[example.type]}</strong>
                <span>{example.place}</span>
              </div>
              <span className={`ticker-status status-${example.status}`}>
                {example.high ? 'Prioridade alta' : governmentStatusLabels[example.status]}
              </span>
            </li>
          ) : null,
        )}
      </ol>
    </section>
  );
}
