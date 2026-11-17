import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { AdminSummary } from '@safewalk/contracts';
import { formatDay } from '../../shared/format';
import { useElementWidth } from '../../shared/use-element-width';

const HEIGHT = 264;
const PAD = { top: 16, right: 22, bottom: 30, left: 38 };
const X_LABEL_SPACE = 52;
const TIP = { width: 148, height: 76, gap: 14 };

type Point = { x: number; y: number };

/** Passo de eixo "redondo" (1, 2, 5, 10, 20…) para caber em cerca de quatro linhas. */
function niceStep(max: number): number {
  const rough = Math.max(1, max / 4);
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}

/** Curva suave que passa por todos os pontos sem ondular além deles (cúbica monotônica). */
function smoothPath(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return '';
  const slopes = points.slice(1).map((point, index) => {
    const before = points[index] ?? point;
    return (point.y - before.y) / (point.x - before.x || 1);
  });
  const tangents = points.map((_, index) => {
    const left = slopes[index - 1];
    const right = slopes[index];
    if (left === undefined) return right ?? 0;
    if (right === undefined) return left;
    return left * right <= 0 ? 0 : (2 * left * right) / (left + right);
  });
  let path = `M${first.x},${first.y}`;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] ?? first;
    const to = points[index] ?? first;
    const third = (to.x - from.x) / 3;
    path += `C${from.x + third},${from.y + (tangents[index - 1] ?? 0) * third} ${to.x - third},${
      to.y - (tangents[index] ?? 0) * third
    } ${to.x},${to.y}`;
  }
  return path;
}

/**
 * Recebidos e resolvidos por dia, em linhas suaves com área. Passar o cursor (ou usar as setas
 * com o gráfico em foco) mostra os valores do dia; a tabela equivalente fica para leitor de tela.
 */
export function DailyChart({ days }: { days: AdminSummary['daily'] }) {
  const [frame, width] = useElementWidth<HTMLDivElement>(760);
  const [active, setActive] = useState<number | null>(null);

  const innerWidth = Math.max(40, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const baseline = PAD.top + innerHeight;
  const peak = Math.max(1, ...days.map((day) => Math.max(day.received, day.resolved)));
  const step = niceStep(peak);
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const xOf = (index: number) =>
    PAD.left + (days.length > 1 ? (index / (days.length - 1)) * innerWidth : innerWidth / 2);
  const yOf = (value: number) => baseline - (value / top) * innerHeight;
  const received = days.map((day, index) => ({ x: xOf(index), y: yOf(day.received) }));
  const resolved = days.map((day, index) => ({ x: xOf(index), y: yOf(day.resolved) }));
  const areaOf = (points: readonly Point[]) =>
    points.length > 1
      ? `${smoothPath(points)}L${points[points.length - 1]?.x ?? 0},${baseline}L${points[0]?.x ?? 0},${baseline}Z`
      : '';
  const labelEvery = Math.max(1, Math.ceil((days.length * X_LABEL_SPACE) / innerWidth));
  const lastIndex = days.length - 1;

  const pointAt = (event: PointerEvent<SVGSVGElement>) => {
    if (days.length === 0) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - PAD.left) / innerWidth;
    setActive(Math.min(lastIndex, Math.max(0, Math.round(ratio * lastIndex))));
  };
  const stepWithKeys = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const from = active ?? lastIndex;
    setActive(Math.min(lastIndex, Math.max(0, from + (event.key === 'ArrowRight' ? 1 : -1))));
  };

  const day = active === null ? undefined : days[active];
  const activeX = active === null ? 0 : xOf(active);
  const tipX =
    activeX + TIP.gap + TIP.width > width - 4 ? activeX - TIP.gap - TIP.width : activeX + TIP.gap;

  return (
    <div className="daily" ref={frame}>
      <svg
        className="daily-plot"
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label="Relatos recebidos e resolvidos por dia. Use as setas para percorrer os dias."
        tabIndex={0}
        onPointerMove={pointAt}
        onPointerDown={pointAt}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={stepWithKeys}
      >
        <defs>
          <linearGradient id="daily-wash-received" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="stop-received" stopOpacity="0.26" />
            <stop offset="1" className="stop-received" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="daily-wash-resolved" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="stop-resolved" stopOpacity="0.2" />
            <stop offset="1" className="stop-resolved" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={yOf(tick)}
              y2={yOf(tick)}
              className={tick === 0 ? 'grid-line grid-base' : 'grid-line'}
            />
            <text x={PAD.left - 10} y={yOf(tick) + 4} textAnchor="end" className="chart-axis">
              {tick}
            </text>
          </g>
        ))}
        {days.map((entry, index) =>
          (lastIndex - index) % labelEvery === 0 ? (
            <text
              key={entry.date}
              x={xOf(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="chart-axis"
            >
              {formatDay(entry.date)}
            </text>
          ) : null,
        )}

        <path d={areaOf(received)} fill="url(#daily-wash-received)" />
        <path d={areaOf(resolved)} fill="url(#daily-wash-resolved)" />
        <path d={smoothPath(received)} className="line line-received" />
        <path d={smoothPath(resolved)} className="line line-resolved" />
        {active === null && (
          <>
            <circle
              cx={received[lastIndex]?.x}
              cy={received[lastIndex]?.y}
              r="4.5"
              className="dot-mark fill-received"
            />
            <circle
              cx={resolved[lastIndex]?.x}
              cy={resolved[lastIndex]?.y}
              r="4.5"
              className="dot-mark fill-resolved"
            />
          </>
        )}

        {day && active !== null && (
          <g className="daily-hover">
            <line x1={activeX} x2={activeX} y1={PAD.top} y2={baseline} className="crosshair" />
            <circle cx={activeX} cy={yOf(day.received)} r="5" className="dot-mark fill-received" />
            <circle cx={activeX} cy={yOf(day.resolved)} r="5" className="dot-mark fill-resolved" />
            <g transform={`translate(${tipX} ${PAD.top + 4})`}>
              <rect width={TIP.width} height={TIP.height} rx="10" className="tip-box" />
              <text x="12" y="21" className="tip-title">
                {formatDay(day.date)}
              </text>
              <line x1="12" x2="24" y1="39" y2="39" className="line line-received" />
              <text x="30" y="43" className="tip-label">
                Recebidos
              </text>
              <text x={TIP.width - 12} y="43" textAnchor="end" className="tip-value">
                {day.received}
              </text>
              <line x1="12" x2="24" y1="59" y2="59" className="line line-resolved" />
              <text x="30" y="63" className="tip-label">
                Resolvidos
              </text>
              <text x={TIP.width - 12} y="63" textAnchor="end" className="tip-value">
                {day.resolved}
              </text>
            </g>
          </g>
        )}
      </svg>
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
          {days.map((entry) => (
            <tr key={entry.date}>
              <td>{formatDay(entry.date)}</td>
              <td>{entry.received}</td>
              <td>{entry.resolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
