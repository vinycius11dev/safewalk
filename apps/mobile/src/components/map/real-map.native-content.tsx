import {
  RECORD_SOURCES,
  RECORD_CLUSTER_MAX_ZOOM,
  RECORD_CLUSTER_PROPERTIES,
  RECORD_CLUSTER_RADIUS,
  EMPTY_RECORDS,
  readRecordCluster,
  recordGroup,
  splitRecordSources,
  type RecordSourceId,
} from './record-clusters';
import { createRecordLayers } from './record-cluster.layers';
import { recordIconImages } from './record-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  Camera,
  Images,
  type GeoJSONSourceRef,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type InitialViewState,
  type LayerProps,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { AppText, Button, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createBaseMapStyle, createOverlayLayers } from './real-map.map-style';
import {
  createMapData,
  interactiveFeatureId,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  lngLat,
  OVERLAY_SOURCE,
  routeBounds,
  URBAN_MIN_ZOOM,
  VIEWPORT_DEBOUNCE_MS,
} from './real-map.model';
import { createRealMapStyles } from './real-map.styles';
import type { MapMode, RealMapProps } from './real-map.types';
import { RainField } from './rain-field.native';

export default function NativeRealMap(props: RealMapProps) {
  const { colors } = useTheme();
  const styles = useMemo(
    () => createRealMapStyles(colors, props.controlsTop, props.attributionTop),
    [colors, props.controlsTop, props.attributionTop],
  );
  const camera = useRef<CameraRef>(null);
  const recordSourceRefs = useRef<Partial<Record<RecordSourceId, GeoJSONSourceRef | null>>>({});
  const alive = useRef(true);
  const [recordError, setRecordError] = useState('');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const map = useRef<MapRef>(null);
  const latest = useRef(props);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [mode, setMode] = useState<MapMode>(props.initialMode ?? '2d');
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const currentZoom = useRef(props.zoom ?? DEFAULT_MAP_ZOOM);
  const [initialViewState] = useState<InitialViewState>(() => ({
    center: lngLat(props.center ?? DEFAULT_MAP_CENTER),
    zoom: props.zoom ?? DEFAULT_MAP_ZOOM,
    pitch: props.initialMode === '3d' ? 52 : 0,
  }));
  const baseStyle = useMemo(() => JSON.stringify(createBaseMapStyle(colors, true)), [colors]);
  const layers = useMemo(() => createOverlayLayers(colors), [colors]);
  const recordLayers = useMemo(
    () =>
      Object.fromEntries(
        RECORD_SOURCES.map((source) => [source, createRecordLayers(colors, source)]),
      ) as Record<RecordSourceId, ReturnType<typeof createRecordLayers>>,
    [colors],
  );
  const recordSources = useMemo(
    () => splitRecordSources(props.recordPoints ?? EMPTY_RECORDS),
    [props.recordPoints],
  );
  const { urbanFeatures, route, alternativeRoute, markers, location, selectedPoint } = props;
  const data = useMemo(
    () =>
      createMapData({ urbanFeatures, route, alternativeRoute, markers, location, selectedPoint }),
    [urbanFeatures, route, alternativeRoute, markers, location, selectedPoint],
  );
  const centerLatitude = props.center?.latitude;
  const centerLongitude = props.center?.longitude;
  const locationLatitude = location?.latitude;
  const locationLongitude = location?.longitude;
  const shouldFitRoute = Boolean(props.fitRoute && (props.route?.length ?? 0) > 1);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => () => clearTimeout(viewportTimer.current), []);

  useEffect(() => {
    if (!loaded || centerLatitude === undefined || centerLongitude === undefined || shouldFitRoute)
      return;
    camera.current?.easeTo({ center: [centerLongitude, centerLatitude], duration: 400 });
  }, [centerLatitude, centerLongitude, shouldFitRoute, loaded]);

  useEffect(() => {
    if (
      !loaded ||
      !props.followLocation ||
      locationLatitude === undefined ||
      locationLongitude === undefined
    )
      return;
    camera.current?.easeTo({
      center: [locationLongitude, locationLatitude],
      zoom: props.followZoom ?? currentZoom.current,
      ...(props.followBearing !== null && props.followBearing !== undefined
        ? { bearing: props.followBearing }
        : {}),
      duration: 700,
    });
  }, [
    locationLatitude,
    locationLongitude,
    props.followLocation,
    props.followZoom,
    props.followBearing,
    loaded,
  ]);

  useEffect(() => {
    if (!loaded || !props.fitRoute) return;
    const bounds = routeBounds(props.route);
    if (bounds)
      camera.current?.fitBounds(bounds, {
        padding: props.fitPadding ?? { top: 150, bottom: 280, left: 45, right: 45 },
        duration: 500,
      });
  }, [props.route, props.fitRoute, props.fitPadding, loaded]);

  return (
    <View style={styles.root}>
      <Map
        key={attempt}
        ref={map}
        style={styles.canvas}
        mapStyle={baseStyle}
        accessibilityLabel={props.accessibilityLabel ?? 'Mapa real. Arraste para navegar.'}
        attributionPosition={styles.attributionPosition}
        attribution
        logo={false}
        compass={false}
        onPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          props.onMapPress?.({ longitude, latitude });
        }}
        onLongPress={(event) => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          props.onMapLongPress?.({ longitude, latitude });
        }}
        onDidFinishLoadingMap={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onDidFailLoadingMap={() => {
          setLoaded(false);
          setFailed(true);
        }}
        onRegionWillChange={(event) => {
          if (event.nativeEvent.userInteraction && latest.current.followLocation)
            latest.current.onFollowLost?.();
        }}
        onRegionDidChange={(event) => {
          const { zoom, bounds } = event.nativeEvent;
          currentZoom.current = zoom;
          clearTimeout(viewportTimer.current);
          if (zoom < URBAN_MIN_ZOOM) return;
          viewportTimer.current = setTimeout(
            () => latest.current.onViewportChange?.(bounds),
            VIEWPORT_DEBOUNCE_MS,
          );
        }}
      >
        <Images images={recordIconImages} />
        <Camera
          ref={camera}
          initialViewState={initialViewState}
          pitch={mode === '3d' ? 52 : 0}
          duration={450}
        />
        <GeoJSONSource
          id={OVERLAY_SOURCE}
          data={data}
          onPress={(event) => {
            const feature = event.nativeEvent.features.find(
              (item) => item.properties?.role === 'marker' || item.properties?.role === 'urban',
            );
            if (!feature || !props.onMarkerPress) return;
            const id = interactiveFeatureId(feature);
            if (id === null) return;
            event.stopPropagation();
            props.onMarkerPress(id);
          }}
        >
          {/* Both clients use style-spec v8. RN pins older expression typings;
              these shared layers use only the common fill/line/circle subset. */}
          {layers.map((layer) => (
            <Layer key={layer.id} {...(layer as LayerProps)} />
          ))}
        </GeoJSONSource>
        {RECORD_SOURCES.map((sourceId) => (
          <GeoJSONSource
            key={sourceId}
            id={sourceId}
            ref={(node) => {
              recordSourceRefs.current[sourceId] = node;
            }}
            data={recordSources[sourceId]}
            cluster
            clusterRadius={RECORD_CLUSTER_RADIUS}
            clusterMaxZoom={RECORD_CLUSTER_MAX_ZOOM}
            clusterProperties={RECORD_CLUSTER_PROPERTIES}
            onPress={(event) => {
              event.stopPropagation();
              const features = event.nativeEvent.features;
              const cluster = features.find((f) => f.properties?.cluster_id !== undefined);
              const source = recordSourceRefs.current[sourceId];
              if (cluster && cluster.geometry.type === 'Point' && source) {
                const center = cluster.geometry.coordinates as [number, number];
                const expected = latest.current.recordPoints;
                void readRecordCluster(
                  source,
                  Number(cluster.properties?.cluster_id),
                  Number(cluster.properties?.point_count),
                )
                  .then(({ ids, zoom }) => {
                    if (!alive.current || latest.current.recordPoints !== expected) return;
                    latest.current.onRecordGroupPress?.(
                      recordGroup(ids, () =>
                        camera.current?.easeTo({ center, zoom: Math.min(20, zoom), duration: 400 }),
                      ),
                    );
                  })
                  .catch(() => {
                    if (alive.current)
                      setRecordError('O grupo foi atualizado. Toque novamente para consultar.');
                  });
                return;
              }
              const ids = [
                ...new Set(
                  features.map(interactiveFeatureId).filter((id): id is string => id !== null),
                ),
              ];
              if (ids.length > 1) {
                const first = features[0];
                if (first?.geometry.type === 'Point') {
                  const center = first.geometry.coordinates as [number, number];
                  props.onRecordGroupPress?.(
                    recordGroup(ids, () =>
                      camera.current?.easeTo({
                        center,
                        zoom: Math.min(20, currentZoom.current + 2),
                        duration: 400,
                      }),
                    ),
                  );
                }
              } else if (ids[0]) props.onMarkerPress?.(ids[0]);
            }}
          >
            {recordLayers[sourceId].map((layer) => (
              <Layer key={layer.id} {...(layer as LayerProps)} />
            ))}
          </GeoJSONSource>
        ))}
      </Map>
      {props.rainStatus && <RainField status={props.rainStatus} controlsTop={props.controlsTop} />}
      {recordError && (
        <View style={styles.status}>
          <AppText variant="small">{recordError}</AppText>
          <Button label="Entendi" variant="ghost" onPress={() => setRecordError('')} />
        </View>
      )}
      {props.showControls !== false && (
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === '2d' ? 'Ativar mapa 3D' : 'Voltar ao mapa 2D'}
            style={styles.control}
            onPress={() => setMode((current) => (current === '2d' ? '3d' : '2d'))}
          >
            <AppText style={styles.mode}>{mode === '2d' ? '3D' : '2D'}</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aproximar mapa"
            style={styles.control}
            onPress={() => camera.current?.zoomTo(Math.min(20, currentZoom.current + 1))}
          >
            <Icon name="plus" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Afastar mapa"
            style={styles.control}
            onPress={() => camera.current?.zoomTo(Math.max(2, currentZoom.current - 1))}
          >
            <Icon name="minus" />
          </Pressable>
          {props.location && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Centralizar na localização autorizada"
              style={styles.control}
              onPress={() =>
                props.location &&
                camera.current?.easeTo({ center: lngLat(props.location), zoom: 16 })
              }
            >
              <Icon name="crosshair" />
            </Pressable>
          )}
        </View>
      )}
      {!loaded && (
        <View style={styles.status} accessibilityRole="alert">
          <AppText variant="small" tone="muted">
            {failed
              ? 'Não foi possível carregar o mapa. Verifique sua conexão.'
              : 'Carregando mapa real…'}
          </AppText>
          {failed && (
            <Button
              label="Tentar novamente"
              onPress={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}
