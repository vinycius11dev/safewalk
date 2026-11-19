import {
  RECORD_SOURCES,
  RECORD_LAYERS,
  EMPTY_RECORDS,
  RECORD_CLUSTER_MAX_ZOOM,
  RECORD_CLUSTER_PROPERTIES,
  RECORD_CLUSTER_RADIUS,
  readRecordCluster,
  recordGroup,
  SIGNAL_SOURCE,
  HELP_SOURCE,
  splitRecordSources,
} from './record-clusters';
import { createRecordLayers } from './record-cluster.layers';
import { recordIconNames } from './record-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as LibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './real-map.css';
import { useTheme } from '@/theme/theme-provider';
import {
  BUILDING_LAYER,
  createBaseMapStyle,
  createOverlayLayers,
  INTERACTIVE_LAYERS,
} from './real-map.map-style';
import {
  createMapData,
  interactiveFeatureId,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  lngLat,
  OVERLAY_SOURCE,
  URBAN_MIN_ZOOM,
  VIEWPORT_DEBOUNCE_MS,
} from './real-map.model';
import type { MapMode, RealMapProps } from './real-map.types';
import { createWebMapStyle } from './real-map.web.styles';
import { fitVisibleRoute } from './real-map.camera';
import { useFollowPadding } from './use-follow-padding';
import { rainStatusDescription, rainStatusLabel } from './rain-status-copy';

export type { RealMapProps, MapMarker, MapBounds, MapMode, MapRainStatus } from './real-map.types';

export function RealMap(props: RealMapProps) {
  const { colors } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const latest = useRef(props);
  const [mode, setMode] = useState<MapMode>(props.initialMode ?? '2d');
  const currentMode = useRef(mode);
  const mapReady = useRef(false);
  const fitFrame = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [attempt, setAttempt] = useState(0);
  const mapStyle = useMemo(
    () => createWebMapStyle(colors, props.controlsTop ?? 118, props.attributionTop ?? 80),
    [colors, props.controlsTop, props.attributionTop],
  );
  const { urbanFeatures, route, alternativeRoute, markers, location, selectedPoint } = props;
  const recordPoints = props.recordPoints ?? EMPTY_RECORDS;
  const recordSources = useMemo(() => splitRecordSources(recordPoints), [recordPoints]);
  const data = useMemo(
    () =>
      createMapData({ urbanFeatures, route, alternativeRoute, markers, location, selectedPoint }),
    [urbanFeatures, route, alternativeRoute, markers, location, selectedPoint],
  );
  const centerLatitude = props.center?.latitude;
  const centerLongitude = props.center?.longitude;
  const locationLatitude = location?.latitude;
  const locationLongitude = location?.longitude;
  const followPadding = useFollowPadding(props.followPadding);
  const shouldFitRoute = Boolean(props.fitRoute && (props.route?.length ?? 0) > 1);

  useEffect(() => {
    latest.current = props;
    currentMode.current = mode;
  });

  const fitRouteAfterLayout = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady.current || !latest.current.fitRoute) return;
    if (fitFrame.current !== undefined) cancelAnimationFrame(fitFrame.current);
    fitFrame.current = requestAnimationFrame(() => {
      fitFrame.current = requestAnimationFrame(() => {
        fitFrame.current = undefined;
        if (mapRef.current !== map || !mapReady.current || !latest.current.fitRoute) return;
        fitVisibleRoute(map, latest.current.route, latest.current.fitPadding, currentMode.current);
      });
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let map: LibreMap | undefined;
    let viewportTimer: ReturnType<typeof setTimeout> | undefined;
    const loadTimeout = setTimeout(() => {
      if (!disposed) {
        setError('O mapa está demorando a carregar. Verifique sua conexão e tente novamente.');
        setStatus('error');
      }
    }, 18000);
    const initialize = async () => {
      try {
        setStatus('loading');
        mapReady.current = false;
        setWarning('');
        const maplibre = await import('maplibre-gl');
        if (disposed || !container.current) return;
        maplibre.setWorkerUrl('/maplibre-worker.mjs?v=6.16.0');
        const initial = latest.current;
        map = new maplibre.Map({
          container: container.current,
          style: createBaseMapStyle(colors, initial.initialMode === '3d'),
          center: lngLat(initial.center ?? DEFAULT_MAP_CENTER),
          zoom: initial.zoom ?? DEFAULT_MAP_ZOOM,
          pitch: initial.initialMode === '3d' ? 52 : 0,
          maxPitch: 60,
          attributionControl: false,
          canvasContextAttributes: { antialias: true },
        });
        mapRef.current = map;
        map.addControl(new maplibre.AttributionControl({ compact: true }), 'top-left');
        const reportViewport = () => {
          clearTimeout(viewportTimer);
          viewportTimer = setTimeout(() => {
            if (disposed || !map || map.getZoom() < URBAN_MIN_ZOOM) return;
            const bounds = map.getBounds();
            latest.current.onViewportChange?.([
              bounds.getWest(),
              bounds.getSouth(),
              bounds.getEast(),
              bounds.getNorth(),
            ]);
          }, VIEWPORT_DEBOUNCE_MS);
        };
        map.on('load', async () => {
          if (disposed || !map) return;
          clearTimeout(loadTimeout);
          // Licenses (OSM/ODbL, OpenMapTiles) require the credits: keep them behind the (i) button.
          map
            .getContainer()
            .querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')
            ?.classList.remove('maplibregl-compact-show');
          map.addSource(OVERLAY_SOURCE, { type: 'geojson', data: createMapData(latest.current) });
          for (const layer of createOverlayLayers(colors)) map.addLayer(layer);
          const initialRecords = splitRecordSources(latest.current.recordPoints ?? EMPTY_RECORDS);
          for (const source of RECORD_SOURCES)
            map.addSource(source, {
              type: 'geojson',
              data: initialRecords[source],
              cluster: true,
              clusterRadius: RECORD_CLUSTER_RADIUS,
              clusterMaxZoom: RECORD_CLUSTER_MAX_ZOOM,
              clusterProperties: RECORD_CLUSTER_PROPERTIES,
            });
          try {
            const icons = await Promise.all(
              recordIconNames.map(async (name) => ({
                name,
                image: await map!.loadImage(`/map-icons/${name}.png`),
              })),
            );
            if (disposed || !map) return;
            for (const { name, image } of icons) map.addImage(name, image.data);
          } catch {
            if (!disposed)
              setWarning(
                'Não foi possível carregar todos os símbolos. Os registros continuam disponíveis na lista.',
              );
          }
          if (disposed || !map) return;
          for (const source of RECORD_SOURCES)
            for (const layer of createRecordLayers(colors, source)) map.addLayer(layer);
          setError('');
          mapReady.current = true;
          setStatus('ready');
          reportViewport();
        });
        map.on('moveend', reportViewport);
        const preview = new maplibre.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: 'safewalk-map-preview',
          maxWidth: '260px',
        });
        let previewId: string | null = null;
        const clearPreview = () => {
          previewId = null;
          preview.remove();
          if (map) map.getCanvas().style.cursor = '';
        };
        map.on('mousemove', (event) => {
          if (!map) return;
          const layers = [...RECORD_LAYERS, ...INTERACTIVE_LAYERS].filter((id) =>
            map?.getLayer(id),
          );
          const feature = layers.length
            ? map.queryRenderedFeatures(event.point, { layers })[0]
            : undefined;
          const id = feature ? interactiveFeatureId(feature) : null;
          const text = feature?.properties?.point_count
            ? feature.source === SIGNAL_SOURCE
              ? `${feature.properties.point_count} semáforos cadastrados próximos. Toque para aproximar.`
              : feature.source === HELP_SOURCE
                ? `${feature.properties.point_count} delegacias e hospitais próximos. Toque para aproximar.`
                : `${feature.properties.point_count} registros próximos. Toque para ver.`
            : id === null
              ? undefined
              : latest.current.markerPreview?.(id);
          if (!text) {
            if (previewId !== null) clearPreview();
            return;
          }
          map.getCanvas().style.cursor = 'pointer';
          if (id !== previewId) {
            preview.setText(text).setLngLat(event.lngLat).addTo(map);
            previewId = id;
          } else {
            preview.setLngLat(event.lngLat);
          }
        });
        map.on('mouseout', clearPreview);
        map.on('movestart', clearPreview);
        map.on('dragstart', () => {
          if (latest.current.followLocation) latest.current.onFollowLost?.();
        });
        map.getCanvas().addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' || !map) return;
          event.preventDefault();
          const center = map.getCenter();
          latest.current.onMapPress?.({ latitude: center.lat, longitude: center.lng });
        });
        // Right click (mouse) or a 600 ms touch hold picks a point. Some mobile browsers also
        // fire `contextmenu` on hold, so a press handled by the timer ignores it.
        let holdTimer: ReturnType<typeof setTimeout> | undefined;
        let holdStart: { x: number; y: number } | null = null;
        let heldAt = 0;
        const pickPoint = (lngLat: { lat: number; lng: number }) => {
          if (disposed || !latest.current.onMapLongPress) return;
          clearPreview();
          latest.current.onMapLongPress({ latitude: lngLat.lat, longitude: lngLat.lng });
        };
        const cancelHold = () => {
          clearTimeout(holdTimer);
          holdStart = null;
        };
        map.on('touchstart', (event) => {
          cancelHold();
          if (!latest.current.onMapLongPress || event.originalEvent.touches.length !== 1) return;
          holdStart = { x: event.point.x, y: event.point.y };
          const lngLat = event.lngLat;
          holdTimer = setTimeout(() => {
            heldAt = Date.now();
            pickPoint(lngLat);
          }, 600);
        });
        map.on('touchmove', (event) => {
          if (
            holdStart &&
            Math.hypot(event.point.x - holdStart.x, event.point.y - holdStart.y) > 10
          )
            cancelHold();
        });
        map.on('touchend', cancelHold);
        map.on('touchcancel', cancelHold);
        map.on('movestart', cancelHold);
        map.on('contextmenu', (event) => {
          if (!latest.current.onMapLongPress) return;
          event.preventDefault();
          if (Date.now() - heldAt < 1000) return;
          pickPoint(event.lngLat);
        });
        map.on('click', (event) => {
          // Lifting the finger after a hold must not also count as a tap.
          if (!map || Date.now() - heldAt < 800) return;
          clearPreview();
          const recordLayers = RECORD_LAYERS.filter((id) => map?.getLayer(id));
          const recordFeatures = recordLayers.length
            ? map.queryRenderedFeatures(event.point, { layers: recordLayers })
            : [];
          const cluster = recordFeatures.find(
            (feature) => feature.properties?.cluster_id !== undefined,
          );
          if (cluster && cluster.geometry.type === 'Point') {
            const source = map.getSource(cluster.source) as GeoJSONSource;
            const expected = latest.current.recordPoints;
            const coordinates = cluster.geometry.coordinates as [number, number];
            void readRecordCluster(
              source,
              Number(cluster.properties.cluster_id),
              Number(cluster.properties.point_count),
            )
              .then(({ ids, zoom }) => {
                if (disposed || !map || latest.current.recordPoints !== expected) return;
                latest.current.onRecordGroupPress?.(
                  recordGroup(ids, () => {
                    if (mapRef.current === map)
                      map.easeTo({ center: coordinates, zoom: Math.min(20, zoom) });
                  }),
                );
              })
              .catch(() => {
                if (!disposed)
                  setWarning(
                    'O grupo foi atualizado. Toque novamente para consultar os registros.',
                  );
              });
            return;
          }
          const ids = [
            ...new Set(
              recordFeatures.map(interactiveFeatureId).filter((id): id is string => id !== null),
            ),
          ];
          if (ids.length > 1) {
            const target = event.lngLat;
            latest.current.onRecordGroupPress?.(
              recordGroup(ids, () =>
                mapRef.current?.easeTo({
                  center: target,
                  zoom: Math.min(20, mapRef.current.getZoom() + 2),
                }),
              ),
            );
            return;
          }
          if (ids[0]) {
            latest.current.onMarkerPress?.(ids[0]);
            return;
          }
          const layers = INTERACTIVE_LAYERS.filter((id) => map?.getLayer(id));
          const feature = layers.length
            ? map.queryRenderedFeatures(event.point, { layers })[0]
            : undefined;
          if (feature && latest.current.onMarkerPress) {
            const id = interactiveFeatureId(feature);
            if (id !== null) {
              latest.current.onMarkerPress(id);
              return;
            }
          }
          latest.current.onMapPress?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        });
        map.on('error', () => {
          if (disposed) return;
          setWarning('Parte do mapa não carregou. A cobertura exibida pode estar incompleta.');
        });
      } catch (cause: unknown) {
        if (disposed) return;
        clearTimeout(loadTimeout);
        setError(
          cause instanceof Error && /WebGL/i.test(cause.message)
            ? 'Este navegador não oferece WebGL para o mapa. Ative a aceleração gráfica ou use outro navegador.'
            : 'O mapa não pôde ser iniciado. Verifique a conexão e tente novamente.',
        );
        setStatus('error');
      }
    };
    void initialize();
    const resizeObserver = new ResizeObserver(() => {
      map?.resize();
      fitRouteAfterLayout();
    });
    if (container.current) resizeObserver.observe(container.current);
    return () => {
      disposed = true;
      clearTimeout(loadTimeout);
      clearTimeout(viewportTimer);
      resizeObserver.disconnect();
      if (fitFrame.current !== undefined) cancelAnimationFrame(fitFrame.current);
      mapReady.current = false;
      mapRef.current = null;
      map?.remove();
    };
  }, [colors, attempt, fitRouteAfterLayout]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    (map.getSource(OVERLAY_SOURCE) as GeoJSONSource | undefined)?.setData(data);
  }, [data, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status === 'ready' && map)
      for (const source of RECORD_SOURCES)
        (map.getSource(source) as GeoJSONSource | undefined)?.setData(recordSources[source]);
  }, [recordSources, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    map.setLayoutProperty(BUILDING_LAYER, 'visibility', mode === '3d' ? 'visible' : 'none');
    map.easeTo({ pitch: mode === '3d' ? 52 : 0, duration: 450 });
  }, [mode, status]);

  useEffect(() => {
    if (
      status !== 'ready' ||
      centerLatitude === undefined ||
      centerLongitude === undefined ||
      shouldFitRoute
    )
      return;
    mapRef.current?.easeTo({ center: [centerLongitude, centerLatitude], duration: 400 });
  }, [centerLatitude, centerLongitude, shouldFitRoute, status]);

  useEffect(() => {
    if (
      status !== 'ready' ||
      !props.followLocation ||
      locationLatitude === undefined ||
      locationLongitude === undefined
    )
      return;
    mapRef.current?.easeTo({
      center: [locationLongitude, locationLatitude],
      zoom: props.followZoom ?? mapRef.current.getZoom(),
      ...(props.followBearing !== null && props.followBearing !== undefined
        ? { bearing: props.followBearing }
        : {}),
      ...(followPadding ? { padding: followPadding } : {}),
      duration: 700,
    });
  }, [
    locationLatitude,
    locationLongitude,
    props.followLocation,
    props.followZoom,
    props.followBearing,
    followPadding,
    status,
  ]);

  useEffect(() => {
    if (status !== 'ready' || !props.fitRoute) return;
    fitRouteAfterLayout();
  }, [props.route, props.fitRoute, props.fitPadding, mode, status, fitRouteAfterLayout]);

  return (
    <div className="safewalk-real-map" style={mapStyle}>
      <div
        className="safewalk-real-map__canvas"
        ref={container}
        role="region"
        aria-label={
          props.accessibilityLabel ??
          'Mapa real de São Paulo. Arraste para navegar e use os controles para aproximar.'
        }
      />
      {props.rainStatus && (
        <>
          {props.rainStatus === 'raining' && (
            <div className="safewalk-real-map__rain" aria-hidden="true" />
          )}
          <div
            className={`safewalk-real-map__rain-status safewalk-real-map__rain-status--${props.rainStatus}`}
            role="status"
            aria-label={rainStatusDescription(props.rainStatus)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {props.rainStatus === 'stale' ? (
                <path d="M12 8v4l2.5 1.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              ) : props.rainStatus === 'unknown' ? (
                <path d="M12 11v5m0-9h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />
              ) : (
                <path d="M20 16.2A4.5 4.5 0 0 0 18 7h-1.2A6.5 6.5 0 0 0 4 9.5 4 4 0 0 0 5 17h2m1 2-1 2m6-2-1 2m6-2-1 2" />
              )}
            </svg>
            <span>{rainStatusLabel(props.rainStatus)}</span>
          </div>
        </>
      )}
      {props.showControls !== false && (
        <div className="safewalk-real-map__controls" role="group" aria-label="Controles do mapa">
          <button
            className="safewalk-real-map__button"
            aria-label={mode === '2d' ? 'Ativar mapa 3D' : 'Voltar ao mapa 2D'}
            aria-pressed={mode === '3d'}
            onClick={() => setMode((current) => (current === '2d' ? '3d' : '2d'))}
          >
            {mode === '2d' ? '3D' : '2D'}
          </button>
          <button
            className="safewalk-real-map__button"
            aria-label="Aproximar mapa"
            onClick={() => mapRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            className="safewalk-real-map__button"
            aria-label="Afastar mapa"
            onClick={() => mapRef.current?.zoomOut()}
          >
            −
          </button>
          {props.fitRoute && (props.route?.length ?? 0) > 1 && (
            <button
              className="safewalk-real-map__button"
              aria-label="Enquadrar rota"
              title="Enquadrar rota"
              onClick={fitRouteAfterLayout}
            >
              ⛶
            </button>
          )}
          {props.location && (
            <button
              className="safewalk-real-map__button"
              aria-label="Centralizar na localização autorizada"
              onClick={() =>
                props.location &&
                mapRef.current?.easeTo({ center: lngLat(props.location), zoom: 16 })
              }
            >
              ◎
            </button>
          )}
        </div>
      )}
      {(status !== 'ready' || warning) && (
        <div
          className={`safewalk-real-map__status ${status === 'error' ? 'safewalk-real-map__status--error' : ''}`}
          role="status"
        >
          <p>
            {status === 'ready'
              ? warning
              : status === 'loading'
                ? error || 'Carregando mapa real…'
                : error}
          </p>
          {status === 'error' && (
            <button
              className="safewalk-real-map__retry"
              onClick={() => {
                setError('');
                setStatus('loading');
                setAttempt((current) => current + 1);
              }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
    </div>
  );
}
