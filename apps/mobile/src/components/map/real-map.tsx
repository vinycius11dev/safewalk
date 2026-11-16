import { Component, lazy, Suspense, type ReactNode } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { RealMapFallback } from './real-map-fallback';
import type { RealMapProps } from './real-map.types';

export type { RealMapProps, MapMarker, MapBounds, MapMode, MapRainStatus } from './real-map.types';

// Expo Go does not contain MapLibre's native module. Delay loading it until a
// development/production build so the rest of the app remains usable in Expo Go.
const NativeRealMap = lazy(() => import('./real-map.native-content'));

class NativeMapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <RealMapFallback message="O módulo de mapa não está disponível neste aplicativo. Instale uma versão de desenvolvimento com MapLibre." />
    ) : (
      this.props.children
    );
  }
}

export function RealMap(props: RealMapProps) {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return (
      <RealMapFallback message="O mapa real precisa de uma versão de desenvolvimento do SafeWalk. O Expo Go não inclui o módulo MapLibre. A versão web também oferece o mapa real." />
    );
  }
  return (
    <NativeMapBoundary>
      <Suspense
        fallback={<RealMapFallback title="Carregando mapa" message="Preparando o mapa real…" />}
      >
        <NativeRealMap {...props} />
      </Suspense>
    </NativeMapBoundary>
  );
}
