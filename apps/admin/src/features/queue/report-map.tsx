import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { configureMapLibre } from './maplibre-setup';
import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import type { AdminReportItem, Coordinates } from '@safewalk/contracts';
import { TypeGlyph } from '../../shared/report-types';
import { situationRoomStyle } from './map-style';

/** Mesmo provedor do app (OpenFreeMap/OpenStreetMap), no estilo escuro, recolorido com a marca. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const SAO_PAULO: [number, number] = [-46.6333, -23.5505];
const FOCUS_ZOOM = 16.2;
const FOCUS_PITCH = 48;
const FOCUS_BEARING = -14;
const FIT_PADDING = 48;

/** Faixas do mapa cobertas pelos painéis flutuantes, em pixels. */
export type MapInsets = { top: number; right: number; bottom: number; left: number };

type Props = {
  items: readonly AdminReportItem[];
  selectedId: string | null;
  /** Relatos recém-chegados: o pino pulsa em ondas por alguns segundos. */
  freshIds: ReadonlySet<string>;
  /** Filtros da busca já respondida; ao mudar, o mapa enquadra o novo conjunto. */
  viewKey: string | null;
  /** Muda quando os painéis sobre o mapa mudam de lugar (abrir o detalhe, trocar de largura). */
  layoutKey: string;
  measureInsets: () => MapInsets;
  /** Ponto crítico de onde a fila foi aberta: o mapa começa nele em vez de enquadrar tudo. */
  target: Coordinates | null;
  onSelect: (id: string) => void;
};

type Pin = {
  marker: maplibregl.Marker;
  body: HTMLDivElement;
  button: HTMLButtonElement;
  /** Marcador do brilho, só nos pontos com vários relatos em aberto do mesmo tipo. */
  glow: maplibregl.Marker | null;
};

const lngLatOf = (item: AdminReportItem): [number, number] => [
  item.location.longitude,
  item.location.latitude,
];

function pinClasses(item: AdminReportItem, selected: boolean, fresh: boolean): string {
  const closed = item.status === 'resolved' || item.status === 'dismissed';
  return [
    'pin',
    `type-${item.type}`,
    closed ? 'is-closed' : '',
    !closed && item.priority === 'high' ? 'is-high' : '',
    !closed && item.nearbyCount > 1 ? 'is-cluster' : '',
    selected ? 'is-selected' : '',
    fresh ? 'is-fresh' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Enquadra todos os relatos na área livre do mapa. Devolve falso quando o mapa ainda não tem
 * área livre (escondido atrás da lista, em tela estreita): o enquadramento fica para depois.
 */
function fitItems(
  map: maplibregl.Map,
  items: readonly AdminReportItem[],
  insets: MapInsets,
): boolean {
  const canvas = map.getCanvas();
  const freeWidth = canvas.clientWidth - insets.left - insets.right - FIT_PADDING * 2;
  const freeHeight = canvas.clientHeight - insets.top - insets.bottom - FIT_PADDING * 2;
  if (freeWidth <= 0 || freeHeight <= 0) return false;
  if (items.length === 0) return true;
  const bounds = new maplibregl.LngLatBounds();
  items.forEach((item) => bounds.extend(lngLatOf(item)));
  map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 15.5, duration: 900 });
  return true;
}

/** Pino: brilho de ponto com vários relatos, anel de prioridade e o botão com o símbolo do tipo. */
function createPin(
  item: AdminReportItem,
  onSelect: (id: string) => void,
): Pick<Pin, 'body' | 'button'> & { holder: HTMLDivElement } {
  // O MapLibre posiciona o invólucro por transform; as classes de estado ficam no corpo interno.
  const holder = document.createElement('div');
  holder.className = 'pin-holder';
  const body = document.createElement('div');
  const ring = document.createElement('span');
  ring.className = 'pin-ring';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pin-button';
  button.innerHTML = renderToStaticMarkup(<TypeGlyph type={item.type} />);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(item.id);
  });
  const count = document.createElement('span');
  count.className = 'pin-count';
  body.append(ring, button, count);
  holder.append(body);
  return { holder, body, button };
}

/**
 * Brilho de um ponto com vários relatos do mesmo tipo. É um marcador à parte, sempre abaixo dos
 * pinos, para que a luz de um ponto nunca cubra o símbolo do pino vizinho.
 */
function createGlow(): HTMLDivElement {
  const holder = document.createElement('div');
  holder.className = 'glow-holder';
  holder.append(document.createElement('span'));
  return holder;
}

function glowClasses(item: AdminReportItem): string {
  return `pin-glow type-${item.type}${item.nearbyCount > 3 ? ' is-large' : ''}`;
}

export function ReportMap({
  items,
  selectedId,
  freshIds,
  viewKey,
  layoutKey,
  measureInsets,
  target,
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pins = useRef(new Map<string, Pin>());
  const onSelectRef = useRef(onSelect);
  const itemsRef = useRef(items);
  const measureRef = useRef(measureInsets);
  const fittedFor = useRef<string | null>(null);
  const announced = useRef(new Set<string>());
  const lastCamera = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  /** Avança quando o mapa muda de tamanho (ex.: passou de escondido a visível). */
  const [sizeTick, setSizeTick] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
    itemsRef.current = items;
    measureRef.current = measureInsets;
  }, [onSelect, items, measureInsets]);

  useEffect(() => {
    if (!container.current) return;
    configureMapLibre();
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      transformStyle: situationRoomStyle,
      center: target ? [target.longitude, target.latitude] : SAO_PAULO,
      zoom: target ? FOCUS_ZOOM : 11,
      maxPitch: 60,
      attributionControl: { compact: true },
    });
    map.setPadding(measureRef.current());
    if (target) map.jumpTo({ center: [target.longitude, target.latitude], zoom: FOCUS_ZOOM });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    let loaded = false;
    map.on('load', () => {
      loaded = true;
      // O primeiro enquadramento pode ter usado um tamanho provisório: refaz com o mapa pronto.
      map.resize();
      map.setPadding(measureRef.current());
      fittedFor.current = null;
      setReady(true);
    });
    map.on('resize', () => setSizeTick((tick) => tick + 1));
    map.on('error', () => {
      if (!loaded) setFailed(true);
    });
    mapRef.current = map;
    const currentPins = pins.current;
    return () => {
      currentPins.forEach((pin) => {
        pin.marker.remove();
        pin.glow?.remove();
      });
      currentPins.clear();
      map.remove();
      mapRef.current = null;
    };
    // O ponto de partida só vale na criação do mapa.
  }, []);

  // Pinos: cria, atualiza e remove conforme a fila muda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wanted = new Set(items.map((item) => item.id));
    for (const [id, pin] of pins.current) {
      if (wanted.has(id)) continue;
      pin.marker.remove();
      pin.glow?.remove();
      pins.current.delete(id);
    }
    for (const item of items) {
      let pin = pins.current.get(item.id);
      if (!pin) {
        const { holder, body, button } = createPin(item, (id) => onSelectRef.current(id));
        const marker = new maplibregl.Marker({ element: holder, anchor: 'center' })
          .setLngLat(lngLatOf(item))
          .addTo(map);
        pin = { marker, body, button, glow: null };
        pins.current.set(item.id, pin);
      }
      pin.marker.setLngLat(lngLatOf(item));
      const open = item.status !== 'resolved' && item.status !== 'dismissed';
      if (open && item.nearbyCount > 1) {
        pin.glow ??= new maplibregl.Marker({ element: createGlow(), anchor: 'center' })
          .setLngLat(lngLatOf(item))
          .addTo(map);
        pin.glow.setLngLat(lngLatOf(item));
        const light = pin.glow.getElement().firstElementChild;
        if (light) light.className = glowClasses(item);
      } else if (pin.glow) {
        pin.glow.remove();
        pin.glow = null;
      }
      pin.body.className = pinClasses(item, item.id === selectedId, freshIds.has(item.id));
      const count = pin.body.querySelector('.pin-count');
      if (count) count.textContent = item.nearbyCount > 1 ? String(item.nearbyCount) : '';
      pin.button.setAttribute(
        'aria-label',
        `${reportLabels[item.type]}, ${governmentStatusLabels[item.status]}, ${item.address}`,
      );
    }
  }, [items, selectedId, freshIds, ready]);

  // Enquadra a fila na primeira resposta e a cada troca de filtro (sem relato aberto).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || viewKey === null || viewKey === fittedFor.current) return;
    if (target || selectedId) {
      fittedFor.current = viewKey;
      return;
    }
    if (fitItems(map, items, measureRef.current())) fittedFor.current = viewKey;
  }, [items, viewKey, selectedId, target, ready, sizeTick]);

  // Relato novo fora da área visível: abre o enquadramento para ele aparecer chegando.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || selectedId) return;
    const arrived = items.filter(
      (item) => freshIds.has(item.id) && !announced.current.has(item.id),
    );
    if (arrived.length === 0) return;
    arrived.forEach((item) => announced.current.add(item.id));
    const insets = measureRef.current();
    const canvas = map.getCanvas();
    const hidden = arrived.some((item) => {
      const point = map.project(lngLatOf(item));
      return (
        point.x < insets.left ||
        point.x > canvas.clientWidth - insets.right ||
        point.y < insets.top ||
        point.y > canvas.clientHeight - insets.bottom
      );
    });
    if (!hidden) return;
    fitItems(map, items, measureRef.current());
  }, [items, freshIds, selectedId, ready]);

  // Câmera: voa até o relato aberto, com leve inclinação; ao fechar, volta ao plano.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = `${selectedId ?? ''}|${layoutKey}`;
    const first = lastCamera.current === null;
    if (key === lastCamera.current) return;
    lastCamera.current = key;
    const padding = measureRef.current();
    const item = itemsRef.current.find((candidate) => candidate.id === selectedId);
    if (item) {
      map.flyTo({
        center: lngLatOf(item),
        zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
        pitch: FOCUS_PITCH,
        bearing: FOCUS_BEARING,
        padding,
        duration: 1600,
        curve: 1.25,
      });
      return;
    }
    // Na abertura da tela quem posiciona a câmera é o enquadramento da fila.
    if (!first) map.easeTo({ pitch: 0, bearing: 0, padding, duration: 700 });
    // Só reage à troca de seleção ou de disposição dos painéis, não a cada atualização da fila.
  }, [selectedId, layoutKey, ready]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" />
      <div className="map-vignette" aria-hidden="true" />
      {failed && (
        <p className="notice notice-error map-error" role="alert">
          Não foi possível carregar o mapa. A lista continua funcionando.
        </p>
      )}
      <ul className="map-legend" aria-label="Legenda do mapa">
        <li>
          <span className="pin-sample pin-sample-high" aria-hidden="true" />
          Prioridade alta
        </li>
        <li>
          <span className="pin-sample pin-sample-cluster" aria-hidden="true" />
          Vários no mesmo ponto
        </li>
        <li>
          <span className="pin-sample pin-sample-closed" aria-hidden="true" />
          Resolvido ou arquivado
        </li>
      </ul>
    </div>
  );
}
