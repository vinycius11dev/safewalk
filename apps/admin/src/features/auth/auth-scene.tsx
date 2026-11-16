import type { ReportType } from '@safewalk/contracts';
import { TypeGlyph } from '../../shared/report-types';

/** Avenidas do mapa (coordenadas do plano 1600x1600); as luzes percorrem esses caminhos. */
const AVENUES = [
  'M-40 1060 L1640 520',
  'M520 -40 C620 420 470 900 640 1640',
  'M-40 380 C420 470 980 300 1640 380',
  'M1100 -40 L960 1640',
  'M-40 1380 C500 1240 1000 1330 1640 1180',
];

/** Luzes: avenida, duração e atraso (s), para nunca andarem em sincronia. */
const FLOWS: readonly {
  path: number;
  dur: number;
  begin: number;
  tone: 'blue' | 'amber' | 'teal';
}[] = [
  { path: 0, dur: 7, begin: 0, tone: 'blue' },
  { path: 0, dur: 7, begin: 3.4, tone: 'amber' },
  { path: 1, dur: 9, begin: 1.2, tone: 'teal' },
  { path: 2, dur: 8, begin: 0.6, tone: 'blue' },
  { path: 2, dur: 8, begin: 4.6, tone: 'amber' },
  { path: 3, dur: 10, begin: 2.2, tone: 'blue' },
  { path: 4, dur: 11, begin: 5, tone: 'teal' },
];

/** Pinos que surgem e somem em ciclo (posições e atrasos em auth.css). */
const PINS: readonly { type: ReportType; slot: string }[] = [
  { type: 'pothole', slot: 'mp-1' },
  { type: 'traffic_light', slot: 'mp-2' },
  { type: 'flood', slot: 'mp-3' },
  { type: 'lighting', slot: 'mp-4' },
  { type: 'sidewalk', slot: 'mp-5' },
  { type: 'obstruction', slot: 'mp-6' },
  { type: 'construction', slot: 'mp-7' },
];

const MINOR = Array.from({ length: 26 }, (_, index) => index * 64);

/**
 * Fundo das telas de acesso: aurora de cores da marca, granulado e um mapa da cidade em
 * perspectiva com relatos chegando. É ilustração: nenhum ponto aqui é dado real.
 */
export function AuthScene() {
  return (
    <div className="auth-scene" aria-hidden="true">
      <div className="auth-aurora">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
      </div>
      <div className="auth-map">
        <div className="auth-plane">
          <svg className="plane-streets" viewBox="0 0 1600 1600">
            <g className="plane-grid">
              {MINOR.map((value) => (
                <line key={`v${value}`} x1={value} y1={0} x2={value} y2={1600} />
              ))}
              {MINOR.map((value) => (
                <line key={`h${value}`} x1={0} y1={value} x2={1600} y2={value} />
              ))}
            </g>
            <g className="plane-avenues">
              {AVENUES.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <g className="plane-flows">
              {FLOWS.map((flow, index) => (
                <circle key={index} className={`flow flow-${flow.tone}`} r="7">
                  <animateMotion
                    dur={`${flow.dur}s`}
                    begin={`${flow.begin}s`}
                    repeatCount="indefinite"
                    path={AVENUES[flow.path]}
                  />
                </circle>
              ))}
            </g>
          </svg>
          <span className="plane-heat heat-1" />
          <span className="plane-heat heat-2" />
          {PINS.map((pin) => (
            <span key={pin.slot} className={`map-pin ${pin.slot} type-${pin.type}`}>
              <span className="map-pin-ring" />
              <span className="map-pin-stand">
                <span className="map-pin-head">
                  <TypeGlyph type={pin.type} />
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
      <div className="auth-grain" />
      <div className="auth-vignette" />
    </div>
  );
}
