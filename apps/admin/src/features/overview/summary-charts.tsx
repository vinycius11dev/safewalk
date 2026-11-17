import { useState } from 'react';
import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import type { AdminSummary, GovernmentStatus } from '@safewalk/contracts';
import { TypeBadge } from '../../shared/report-types';

const statuses: GovernmentStatus[] = [
  'received',
  'analyzing',
  'dispatched',
  'resolved',
  'dismissed',
];

const SIZE = 184;
const RADIUS = 72;
/** Folga entre fatias, em radianos (cerca de 3 px no raio do anel). */
const GAP = 3 / RADIUS;
const TURN = Math.PI * 2;

/** Arco do anel entre dois ângulos, medidos a partir do topo, no sentido horário. */
function arcPath(from: number, to: number): string {
  const at = (angle: number) =>
    `${SIZE / 2 + RADIUS * Math.sin(angle)},${SIZE / 2 - RADIUS * Math.cos(angle)}`;
  return `M${at(from)}A${RADIUS},${RADIUS} 0 ${to - from > Math.PI ? 1 : 0} 1 ${at(to)}`;
}

/**
 * Anel com a proporção de cada andamento. A lista ao lado repete nome, quantidade e parcela,
 * então a cor nunca é a única pista; passar o cursor destaca uma fatia.
 */
export function StatusDonut({ counts }: { counts: AdminSummary['counts'] }) {
  const [active, setActive] = useState<GovernmentStatus | null>(null);
  const total = statuses.reduce((sum, status) => sum + counts[status], 0);
  const present = statuses.filter((status) => counts[status] > 0);
  let cursor = 0;
  const slices = present.map((status) => {
    const sweep = (counts[status] / total) * TURN;
    const slice = { status, from: cursor, to: cursor + sweep };
    cursor += sweep;
    return slice;
  });
  const share = (status: GovernmentStatus) =>
    total === 0 ? '0%' : `${Math.round((counts[status] / total) * 100)}%`;

  return (
    <div className="donut" data-active={active ?? undefined}>
      <svg
        className="donut-ring"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Relatos por andamento: ${statuses
          .map((status) => `${governmentStatusLabels[status]} ${counts[status]}`)
          .join(', ')}`}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} className="donut-track" />
        {slices.length === 1 && slices[0] ? (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            className={`donut-slice stroke-${slices[0].status}`}
          />
        ) : (
          slices.map(({ status, from, to }) => (
            <path
              key={status}
              d={arcPath(from + GAP / 2, Math.max(from + GAP / 2 + 0.001, to - GAP / 2))}
              className={`donut-slice stroke-${status}`}
              data-dim={active !== null && active !== status ? 'true' : undefined}
              onPointerEnter={() => setActive(status)}
              onPointerLeave={() => setActive(null)}
            />
          ))
        )}
        <text x={SIZE / 2} y={SIZE / 2 + 4} textAnchor="middle" className="donut-total">
          {(active ? counts[active] : total).toLocaleString('pt-BR')}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 24} textAnchor="middle" className="donut-caption">
          {active ? governmentStatusLabels[active].toLowerCase() : 'relatos no total'}
        </text>
      </svg>
      <ul className="donut-legend">
        {statuses.map((status) => (
          <li
            key={status}
            data-dim={active !== null && active !== status ? 'true' : undefined}
            onPointerEnter={() => setActive(status)}
            onPointerLeave={() => setActive(null)}
          >
            <span className={`swatch fill-bg-${status}`} aria-hidden="true" />
            <span className="donut-legend-label">{governmentStatusLabels[status]}</span>
            <strong className="num">{counts[status].toLocaleString('pt-BR')}</strong>
            <span className="donut-legend-share num">{share(status)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais na cor de cada tipo, com o símbolo, o nome e o valor escritos. */
export function TypeBars({ rows }: { rows: AdminSummary['openByType'] }) {
  const max = Math.max(...rows.map((row) => row.count));
  return (
    <ol className="type-bars">
      {rows.map((row) => (
        <li key={row.type} className={`type-bar type-${row.type}`}>
          <TypeBadge type={row.type} />
          <span className="type-bar-label">{reportLabels[row.type]}</span>
          <svg className="type-bar-track" height="12" aria-hidden="true">
            <rect width="100%" height="12" rx="4" className="bar-track" />
            {/* Ponta arredondada no valor; a base, à esquerda, fica reta. */}
            <rect width="6" height="12" className="type-bar-fill" />
            <rect
              width={`${Math.max(2, (row.count / max) * 100)}%`}
              height="12"
              rx="4"
              className="type-bar-fill"
            />
          </svg>
          <strong className="num">{row.count.toLocaleString('pt-BR')}</strong>
        </li>
      ))}
    </ol>
  );
}
