import type { AdminSummary } from '@safewalk/contracts';
import { formatDay } from '../../shared/format';

const WIDTH = 760;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 30, left: 30 };

/** Barras pareadas (recebidos e resolvidos) dos últimos dias, com a tabela equivalente para leitor de tela. */
export function DailyChart({ days }: { days: AdminSummary['daily'] }) {
  const max = Math.max(4, ...days.map((day) => Math.max(day.received, day.resolved)));
  const innerWidth = WIDTH - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerWidth / days.length;
  const bar = Math.min(16, slot * 0.34);
  const scale = (value: number) => (value / max) * innerHeight;
  const ticks = [0, Math.round(max / 2), max];
  return (
    <div className="daily">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Relatos recebidos e resolvidos por dia"
      >
        {ticks.map((tick) => {
          const y = PAD.top + innerHeight - scale(tick);
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="grid-line" />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="chart-axis">
                {tick}
              </text>
            </g>
          );
        })}
        {days.map((day, index) => {
          const center = PAD.left + slot * index + slot / 2;
          const receivedHeight = scale(day.received);
          const resolvedHeight = scale(day.resolved);
          return (
            <g key={day.date}>
              <rect
                x={center - bar - 1}
                y={PAD.top + innerHeight - receivedHeight}
                width={bar}
                height={receivedHeight}
                rx="3"
                className="fill-received"
              />
              <rect
                x={center + 1}
                y={PAD.top + innerHeight - resolvedHeight}
                width={bar}
                height={resolvedHeight}
                rx="3"
                className="fill-resolved"
              />
              <text x={center} y={HEIGHT - 8} textAnchor="middle" className="chart-axis">
                {formatDay(day.date)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="legend">
        <li>
          <span className="swatch fill-bg-received" aria-hidden="true" />
          Recebidos
        </li>
        <li>
          <span className="swatch fill-bg-resolved" aria-hidden="true" />
          Resolvidos
        </li>
      </ul>
      <table className="sr-only">
        <caption>Relatos por dia</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Recebidos</th>
            <th>Resolvidos</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td>{formatDay(day.date)}</td>
              <td>{day.received}</td>
              <td>{day.resolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
