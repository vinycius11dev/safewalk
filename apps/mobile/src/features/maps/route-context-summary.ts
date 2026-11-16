import type { RealRoute, RoutingPreference, ProfileSettings } from '@safewalk/contracts';
import { countLabel as count } from '@/lib/count-label';

export type RouteContextSummary = {
  lighting: number;
  crossings: number;
  sidewalks: number;
  flood: number;
  sp156: number;
  healthAccessibility: number;
  capped: boolean;
  empty: boolean;
};
const floodTypes = new Set(['flood_history', 'flood_risk', 'flood_susceptibility', 'floods']);
export function summarizeRouteContext(
  route: Pick<RealRoute, 'context'> | null,
): RouteContextSummary {
  const features = route?.context?.nearbyFeatures ?? [];
  const summary: RouteContextSummary = {
    lighting: 0,
    crossings: 0,
    sidewalks: 0,
    flood: 0,
    sp156: 0,
    healthAccessibility: 0,
    capped: features.length >= 100,
    empty: features.length === 0,
  };
  for (const feature of features) {
    const type = feature.properties.type;
    if (type === 'lighting') summary.lighting += 1;
    else if (type === 'crossings') summary.crossings += 1;
    else if (type === 'sidewalks') summary.sidewalks += 1;
    else if (floodTypes.has(type)) summary.flood += 1;
    else if (type === 'sp156') summary.sp156 += 1;
    else if (type === 'health' || type === 'accessibility') summary.healthAccessibility += 1;
  }
  return summary;
}
export function routeContextText(route: Pick<RealRoute, 'context'> | null): string {
  const summary = summarizeRouteContext(route);
  if (summary.empty)
    return 'Sem dados em cache para este trecho. Isso não indica ausência de risco.';
  const parts = [
    summary.lighting
      ? count(summary.lighting, 'luminária cadastrada', 'luminárias cadastradas')
      : '',
    summary.crossings ? count(summary.crossings, 'semáforo', 'semáforos') : '',
    summary.sidewalks ? count(summary.sidewalks, 'trecho de calçada', 'trechos de calçada') : '',
    summary.flood ? count(summary.flood, 'área de inundação', 'áreas de inundação') : '',
    summary.sp156 ? count(summary.sp156, 'registro SP156', 'registros SP156') : '',
    summary.healthAccessibility
      ? count(
          summary.healthAccessibility,
          'ponto de saúde ou acessibilidade',
          'pontos de saúde ou acessibilidade',
        )
      : '',
  ].filter(Boolean);
  const limit = summary.capped ? '100+ registros · ' : '';
  return `Na faixa de 50 m (dados em cache, parciais): ${limit}${parts.join(' · ')}`;
}
export function defaultRoutePreference(
  walkingProfile: ProfileSettings['walkingProfile'] | undefined,
): RoutingPreference {
  if (walkingProfile === 'night') return 'prefer_lit';
  if (walkingProfile === 'pcd') return 'step_free';
  return 'standard';
}
export const routePreferenceOptions: { value: RoutingPreference; label: string }[] = [
  { value: 'standard', label: 'Padrão' },
  { value: 'prefer_lit', label: 'Preferir iluminadas' },
  { value: 'step_free', label: 'Sem escadas' },
];
/** What the saved walking profile changed in the calculation, as a short badge suffix. */
export function walkingProfileRouteLabel(profile: RealRoute['walkingProfile']): string | null {
  if (profile === 'pcd') return 'ritmo calmo';
  if (profile === 'child') return 'calçadas';
  return null;
}
type RouteMode = Pick<RealRoute, 'profile' | 'wheelchair'>;
/** How the route is travelled, in a short phrase for summaries. */
export function routeModeName(route: RouteMode): string {
  if (route.profile === 'auto') return 'Rota de carro';
  return route.wheelchair ? 'Rota para cadeira de rodas' : 'Rota de pedestres';
}
export function routeModeShort(route: RouteMode): string {
  if (route.profile === 'auto') return 'De carro';
  return route.wheelchair ? 'Cadeira de rodas' : 'A pé';
}
/** What shapes the calculation, shown next to the route options. */
export function routeCriteriaText(
  mode: 'pedestrian' | 'wheelchair' | 'auto',
  preference: RealRoute['preference'],
  walkingProfile: RealRoute['walkingProfile'],
): string {
  if (mode === 'auto') return 'Sem trânsito ao vivo';
  if (mode === 'wheelchair') return 'Evita escadas e ladeiras · ritmo calmo';
  const base =
    preference === 'standard'
      ? 'Rota padrão'
      : routePreferenceOptions.find((option) => option.value === preference)?.label;
  return [base, walkingProfileRouteLabel(walkingProfile)].filter(Boolean).join(' · ');
}
export function routePreferenceLabel(preference: RealRoute['preference']): string {
  if (preference === 'prefer_lit') return 'Critério: preferir iluminadas';
  if (preference === 'step_free') return 'Critério: sem escadas';
  return 'Rota padrão do provedor';
}
