import type { UrbanLayerType } from '@safewalk/contracts';

/**
 * What the "Alagamentos" filter (and rain) turns on: places that already flooded (Defesa Civil
 * history) and areas that can flood (Prefeitura flood model). The SGB susceptibility map is not
 * here on purpose: the map consent promises it is only queried after the person enables it in
 * "Camadas do mapa".
 */
export const FLOOD_LAYERS: readonly UrbanLayerType[] = ['flood_history', 'flood_risk'];

/** Layers to request: the user's choice, plus the flood layers while the model shows rain. */
export function effectiveMapLayers(
  selected: readonly UrbanLayerType[],
  raining: boolean,
): UrbanLayerType[] {
  return [...new Set([...selected, ...(raining ? FLOOD_LAYERS : [])])];
}

export function floodLayersOn(selected: readonly UrbanLayerType[]): boolean {
  return [...FLOOD_LAYERS, 'flood_susceptibility'].some((type) =>
    selected.includes(type as UrbanLayerType),
  );
}
