import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { configureMapLibre } from './maplibre-setup';
import { governmentStatusLabels, reportLabels } from '@safewalk/contracts';
import type { AdminReportItem, Coordinates } from '@safewalk/contracts';
import { TypeGlyph } from '../../shared/report-types';

/** Mesmo provedor do app (OpenFreeMap/OpenStreetMap); o estilo "positron" é neutro e deixa os pinos em destaque. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const SAO_PAULO: [number, number] = [-46.6333, -23.5505];
const FIT_PADDING = 70;
const FOCUS_ZOOM = 16;

type Props = {
  items: readonly AdminReportItem[];
  selectedId: string | null;
  /** Ponto crítico de onde a fila foi aberta: o mapa começa nele em vez de enquadrar tudo. */
  target: Coordinates | null;
  onSelect: (id: string) => void;
};

type Pin = { marker: maplibregl.Marker; element: HTMLButtonElement };

function pinClasses(item: AdminReportItem, selected: boolean): string {
  const closed = item.status === 'resolved' || item.status === 'dismissed';
  return [
    'pin',
    `type-${item.type}`,
    `priority-${item.priority}`,
    closed ? 'pin-closed' : '',
    selected ? 'pin-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function ReportMap({ items, selectedId, target, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pins = useRef(new Map<string, Pin>());
  const onSelectRef = useRef(onSelect);
  const fittedFor = useRef('');
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    configureMapLibre();
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: target ? [target.longitude, target.latitude] : SAO_PAULO,
      zoom: target ? FOCUS_ZOOM : 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    let loaded = false;
    map.on('load', () => {
      loaded = true;
      // O primeiro enquadramento pode ter usado um tamanho provisório: refaz com o mapa pronto.
      map.resize();
      fittedFor.current = '';
      setReady(true);
    });
    map.on('error', () => {
      if (!loaded) setFailed(true);
    });
    mapRef.current = map;
    const currentPins = pins.current;
    return () => {
      currentPins.forEach((pin) => pin.marker.remove());
      currentPins.clear();
      map.remove();
      mapRef.current = null;
    };
    // O ponto de partida só vale na criação do mapa.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wanted = new Set(items.map((item) => item.id));
    for (const [id, pin] of pins.current) {
      if (wanted.has(id)) continue;
      pin.marker.remove();
      pins.current.delete(id);
    }
    for (const item of items) {
      let pin = pins.current.get(item.id);
      if (!pin) {
        // O MapLibre posiciona o invólucro por transform; o botão dentro pode crescer à vontade.
        const holder = document.createElement('div');
        holder.className = 'pin-holder';
        const element = document.createElement('button');
        element.type = 'button';
        element.innerHTML = renderToStaticMarkup(<TypeGlyph type={item.type} />);
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          onSelectRef.current(item.id);
        });
        holder.append(element);
        const marker = new maplibregl.Marker({ element: holder, anchor: 'center' })
          .setLngLat([item.location.longitude, item.location.latitude])
          .addTo(map);
        pin = { marker, element };
        pins.current.set(item.id, pin);
      }
      pin.marker.setLngLat([item.location.longitude, item.location.latitude]);
      pin.element.className = pinClasses(item, item.id === selectedId);
      pin.element.setAttribute(
        'aria-label',
        `${reportLabels[item.type]}, ${governmentStatusLabels[item.status]}, ${item.address}`,
      );
    }
    const signature = items.map((item) => item.id).join(',');
    if (!target && !selectedId && items.length > 0 && signature !== fittedFor.current) {
      fittedFor.current = signature;
      const bounds = new maplibregl.LngLatBounds();
      items.forEach((item) => bounds.extend([item.location.longitude, item.location.latitude]));
      map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 16, duration: 600 });
    }
  }, [items, selectedId, target, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const item = items.find((candidate) => candidate.id === selectedId);
    if (!map || !item) return;
    map.easeTo({
      center: [item.location.longitude, item.location.latitude],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      duration: 500,
    });
    // Só reage à troca de seleção, não a cada atualização da fila.
  }, [selectedId]);

  return (
    <div className="map-wrap">
      <div ref={container} className="map-canvas" />
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
          <span className="pin-sample pin-sample-closed" aria-hidden="true" />
          Resolvido ou arquivado
        </li>
      </ul>
    </div>
  );
}
