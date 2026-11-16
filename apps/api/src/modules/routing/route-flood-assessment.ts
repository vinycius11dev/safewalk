import type {
  FloodRouteAssessment,
  RealRoute,
  UrbanFeature,
  UrbanLayersResponse,
  UrbanSource,
} from '@safewalk/contracts';
import { attachCachedContext } from './route-context.js';

const maxWeatherAgeMs = 60 * 60 * 1000;
const maxActiveEventAgeMs = 90 * 60 * 1000;
const maxFutureClockSkewMs = 5 * 60 * 1000;
const modeledFloodTypes = new Set(['flood_risk', 'flood_susceptibility']);
const floodSourceTypes = new Set(['flood_history', 'flood_risk', 'flood_susceptibility']);
const rainWeatherCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

function isFreshSource(source: UrbanSource, now: number): boolean {
  return (
    source.status === 'available' && source.expiresAt !== null && Date.parse(source.expiresAt) > now
  );
}

function sourceStatus(
  sources: UrbanSource[],
  now: number,
): {
  status: FloodRouteAssessment['sourceStatus'];
  source: UrbanSource | null;
} {
  const currentSources = sources.filter(
    (source) => source.type === 'floods' && source.georeferencedCurrentEvents === true,
  );
  const freshCurrent = currentSources.find((source) => isFreshSource(source, now));
  if (freshCurrent) return { status: 'available', source: freshCurrent };
  if (currentSources.some((source) => source.status === 'stale' || source.expiresAt !== null))
    return { status: 'stale', source: currentSources[0] ?? null };
  if (currentSources.some((source) => source.status === 'not_configured'))
    return { status: 'not_configured', source: currentSources[0] ?? null };
  if (currentSources.length) return { status: 'unavailable', source: currentSources[0] ?? null };

  const aggregate = sources.find((source) => source.id === 'cge-floods');
  if (aggregate && isFreshSource(aggregate, now))
    return { status: 'aggregate_only', source: aggregate };
  if (aggregate && (aggregate.status === 'stale' || aggregate.expiresAt !== null))
    return { status: 'stale', source: aggregate };
  if (aggregate?.status === 'not_configured')
    return { status: 'not_configured', source: aggregate };
  if (aggregate) return { status: 'unavailable', source: aggregate };
  return { status: 'unavailable', source: null };
}

function modelSourceStatus(
  sources: UrbanSource[],
  now: number,
): {
  status: FloodRouteAssessment['modelSourceStatus'];
  source: UrbanSource | null;
} {
  const candidates = sources.filter((source) => floodSourceTypes.has(source.type));
  const fresh = candidates
    .filter((source) => isFreshSource(source, now))
    .sort((a, b) => Date.parse(b.fetchedAt ?? '') - Date.parse(a.fetchedAt ?? ''))[0];
  if (fresh) return { status: 'available', source: fresh };
  const stale = candidates.find(
    (source) =>
      source.status === 'stale' ||
      (source.expiresAt !== null && Date.parse(source.expiresAt) <= now),
  );
  if (stale) return { status: 'stale', source: stale };
  const notConfigured = candidates.find((source) => source.status === 'not_configured');
  if (notConfigured) return { status: 'not_configured', source: notConfigured };
  return { status: 'unavailable', source: candidates[0] ?? null };
}

function weatherCondition(data: UrbanLayersResponse | null, now: number) {
  const weather = data?.weather;
  if (!weather) return 'unknown' as const;
  const observedAt = Date.parse(weather.observedAt);
  if (
    Date.parse(weather.expiresAt) <= now ||
    now - observedAt > maxWeatherAgeMs ||
    observedAt > now + maxFutureClockSkewMs
  )
    return 'stale' as const;
  return weather.precipitationMillimeters > 0 ||
    weather.rainMillimeters > 0 ||
    rainWeatherCodes.has(weather.weatherCode)
    ? ('raining' as const)
    : ('dry' as const);
}

function freshActiveFlood(
  feature: Pick<UrbanFeature['properties'], 'type' | 'sourceId' | 'observedAt' | 'details'>,
  currentSourceIds: Set<string>,
  now: number,
): boolean {
  if (
    feature.type !== 'floods' ||
    !currentSourceIds.has(feature.sourceId) ||
    feature.details.liveFlood !== true ||
    !feature.observedAt
  )
    return false;
  const observedAt = Date.parse(feature.observedAt);
  return now - observedAt <= maxActiveEventAgeMs && observedAt <= now + maxFutureClockSkewMs;
}

function summaryFor(
  assessment: Omit<FloodRouteAssessment, 'preferredAlternative' | 'evaluatedAt' | 'summary'>,
): string {
  const mode = assessment.profile === 'auto' ? 'carro' : 'pedestre';
  if (assessment.recommendation === 'avoid')
    return `Há ${assessment.impassableIncidentCount} ocorrência(s) georreferenciada(s), recente(s) e indicada(s) como intransitável(is) para ${mode}. Evite este trajeto e confira a fonte.`;
  if (assessment.activeIncidentCount > 0)
    return `${assessment.activeIncidentCount} ocorrência(s) atual(is) georreferenciada(s) próxima(s) do trajeto; a condição para ${mode} não está totalmente confirmada.`;
  const knownAreas = assessment.historicalAreaCount + assessment.modeledAreaCount;
  if (assessment.weatherCondition === 'raining' && knownAreas > 0)
    return `Chuva estimada na região e ${knownAreas} registro(s) histórico(s) ou modelado(s) de inundação próximo(s). Isso não confirma água na via.`;
  if (knownAreas > 0)
    return `${knownAreas} registro(s) histórico(s) ou modelado(s) próximo(s); não são confirmação de alagamento ativo.`;
  if (assessment.sourceStatus === 'aggregate_only')
    return 'O CGE informa totais municipais sem coordenadas verificadas; não dá para confirmar alagamentos neste trajeto.';
  if (assessment.sourceStatus === 'stale')
    return 'Os dados de alagamento estão desatualizados; confira as fontes antes de sair.';
  if (assessment.sourceStatus === 'available' && !assessment.coveragePartial)
    return 'Nenhuma ocorrência ativa georreferenciada foi localizada nesta consulta; isso não comprova ausência de risco.';
  return 'Não há dados georreferenciados recentes e completos suficientes para avaliar alagamentos neste trajeto.';
}

export function assessRouteFlood(
  route: RealRoute,
  data: UrbanLayersResponse | null,
  now = Date.now(),
): FloodRouteAssessment {
  const sources = data?.sources ?? route.context?.sources ?? [];
  const active = sourceStatus(sources, now);
  const modeled = modelSourceStatus(sources, now);
  const weather = weatherCondition(data, now);
  const currentSourceIds = new Set(
    sources
      .filter((source) => source.type === 'floods' && source.georeferencedCurrentEvents === true)
      .filter((source) => isFreshSource(source, now))
      .map((source) => source.id),
  );
  const currentModelSourceIds = new Set(
    sources.filter((source) => isFreshSource(source, now)).map((source) => source.id),
  );
  const features = route.context?.nearbyFeatures ?? [];
  const activeFeatures = features.filter((feature) =>
    freshActiveFlood(feature.properties, currentSourceIds, now),
  );
  const blocked = activeFeatures.filter((feature) => {
    const key = route.profile === 'auto' ? 'vehiclePassability' : 'pedestrianPassability';
    return feature.properties.details[key] === 'impassable';
  });
  const historicalAreaCount = features.filter(
    (feature) =>
      feature.properties.type === 'flood_history' &&
      currentModelSourceIds.has(feature.properties.sourceId),
  ).length;
  const modeledAreaCount = features.filter(
    (feature) =>
      modeledFloodTypes.has(feature.properties.type) &&
      currentModelSourceIds.has(feature.properties.sourceId),
  ).length;
  const coveragePartial =
    !data ||
    data.truncated ||
    data.coverageWarnings.length > 0 ||
    active.status !== 'available' ||
    modeled.status !== 'available';

  let recommendation: FloodRouteAssessment['recommendation'] = 'unknown';
  if (blocked.length) recommendation = 'avoid';
  else if (
    activeFeatures.length > 0 ||
    (weather === 'raining' && historicalAreaCount + modeledAreaCount > 0)
  )
    recommendation = 'caution';
  else if (historicalAreaCount + modeledAreaCount > 0) recommendation = 'history';
  else if (active.status === 'available' && !coveragePartial)
    recommendation = 'no_reported_incident';

  const base = {
    profile: route.profile,
    recommendation,
    weatherCondition: weather,
    activeIncidentCount: activeFeatures.length,
    impassableIncidentCount: blocked.length,
    historicalAreaCount,
    modeledAreaCount,
    sourceId: active.source?.id ?? null,
    sourceStatus: active.status,
    sourceAsOf: active.source?.asOf ?? null,
    sourceFetchedAt: active.source?.fetchedAt ?? null,
    sourceExpiresAt: active.source?.expiresAt ?? null,
    modelSourceStatus: modeled.status,
    modelSourceAsOf: modeled.source?.asOf ?? null,
    modelSourceFetchedAt: modeled.source?.fetchedAt ?? null,
    modelSourceExpiresAt: modeled.source?.expiresAt ?? null,
    coveragePartial,
  } satisfies Omit<FloodRouteAssessment, 'preferredAlternative' | 'summary' | 'evaluatedAt'>;
  return {
    ...base,
    preferredAlternative: false,
    summary: summaryFor(base),
    evaluatedAt: new Date(now).toISOString(),
  };
}

export function withFloodAssessment(
  route: RealRoute,
  data: UrbanLayersResponse | null,
  now = Date.now(),
): RealRoute {
  const contextual = data ? attachCachedContext(route, data) : route;
  const context = contextual.context ?? {
    method: 'cached_features_within_50m' as const,
    bufferMeters: 50 as const,
    nearbyFeatures: [],
    sources: [],
    checkedAt: new Date(now).toISOString(),
    truncated: true,
    coverageWarnings: ['Não há dados georreferenciados atuais suficientes para esta rota.'],
  };
  const assessment = assessRouteFlood(contextual, data, now);
  return { ...contextual, context: { ...context, floodAssessment: assessment } };
}

/** Add a relative, explicitly non-safety ranking only when fresh rain and modeled sources differ. */
export function markLowerKnownFloodExposure(routes: RealRoute[]): RealRoute[] {
  const candidates = routes.filter((route) => route.context?.floodAssessment);
  if (
    candidates.length < 2 ||
    candidates.some((route) => {
      const assessment = route.context!.floodAssessment!;
      return (
        assessment.weatherCondition !== 'raining' ||
        assessment.modelSourceStatus !== 'available' ||
        assessment.activeIncidentCount > 0 ||
        assessment.recommendation === 'avoid'
      );
    })
  )
    return routes;

  const exposure = (route: RealRoute) => {
    const assessment = route.context!.floodAssessment!;
    return assessment.historicalAreaCount + assessment.modeledAreaCount;
  };
  const counts = candidates.map(exposure);
  const minimum = Math.min(...counts);
  if (minimum === Math.max(...counts)) return routes;

  const preferred = candidates
    .filter((route) => exposure(route) === minimum)
    .sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
  if (!preferred) return routes;

  return routes.map((route) => {
    if (route.id !== preferred.id || !route.context?.floodAssessment) return route;
    const assessment: FloodRouteAssessment = {
      ...route.context.floodAssessment,
      recommendation: 'lower_known_exposure',
      preferredAlternative: true,
      summary: `Esta alternativa cruza menos registros conhecidos de inundação (${minimum}) que as demais na consulta. Cobertura parcial; não garante que a via esteja livre.`,
    };
    return { ...route, context: { ...route.context, floodAssessment: assessment } };
  });
}
