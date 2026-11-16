import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import type { AdminSummary, GovernmentStatus } from '@safewalk/contracts';

const statuses: GovernmentStatus[] = [
  'received',
  'analyzing',
  'dispatched',
  'resolved',
  'dismissed',
];

/** Barra única com a proporção de cada andamento; cor e texto repetem a mesma informação. */
export function StatusBar({ counts }: { counts: AdminSummary['counts'] }) {
  const total = statuses.reduce((sum, status) => sum + counts[status], 0);
  const width = 600;
  let offset = 0;
  return (
    <div className="status-bar">
      <svg viewBox={`0 0 ${width} 18`} role="img" aria-label="Proporção de relatos por andamento">
        <rect x="0" y="0" width={width} height="18" rx="9" className="bar-track" />
        {total > 0 &&
          statuses.map((status) => {
            const part = (counts[status] / total) * width;
            const x = offset;
            offset += part;
            return part > 0 ? (
              <rect
                key={status}
                x={x}
                y="0"
                width={part}
                height="18"
                className={`fill-${status}`}
              />
            ) : null;
          })}
      </svg>
      <ul className="legend">
        {statuses.map((status) => (
          <li key={status}>
            <span className={`swatch fill-bg-${status}`} aria-hidden="true" />
            {governmentStatusLabels[status]}
            <strong>{counts[status].toLocaleString('pt-BR')}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ROW = 34;
const LABEL_WIDTH = 170;
const BAR_WIDTH = 360;

/** Barras horizontais com o valor escrito na ponta. */
export function TypeBars({ rows }: { rows: AdminSummary['openByType'] }) {
  const max = Math.max(...rows.map((row) => row.count));
  const height = rows.length * ROW;
  return (
    <svg
      className="type-bars"
      viewBox={`0 0 ${LABEL_WIDTH + BAR_WIDTH + 50} ${height}`}
      role="img"
      aria-label={`Relatos em aberto por tipo: ${rows.map((row) => `${reportLabels[row.type]} ${row.count}`).join(', ')}`}
    >
      {rows.map((row, index) => {
        const y = index * ROW;
        const length = Math.max(4, (row.count / max) * BAR_WIDTH);
        return (
          <g key={row.type}>
            <text x="0" y={y + 21} className="chart-label">
              {reportLabels[row.type]}
            </text>
            <rect
              x={LABEL_WIDTH}
              y={y + 6}
              width={length}
              height="20"
              rx="5"
              className={`fill-type-${row.type}`}
            />
            <text x={LABEL_WIDTH + length + 8} y={y + 21} className="chart-value">
              {row.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
