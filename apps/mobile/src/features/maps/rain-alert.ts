import type { Coordinates, FloodRouteAssessment, UrbanFeature } from '@safewalk/contracts';
import {
  formatStraightDistance,
  placeName,
  pointOf,
  straightDistanceMeters,
} from './nearby-places';

export type RainAlert = {
  title: string;
  message: string;
  /** Where it already flooded closest to the person, when their position is known. */
  nearest: string | null;
  historyCount: number;
  areaCount: number;
};

/** Beyond this the closest record says nothing useful about the person's surroundings. */
const NEAREST_MAX_METERS = 5000;

/** A response is capped, so big counts only say "many": "mais de 100", never a false exact figure. */
const MANY = 100;

function countText(count: number, one: string, many: string, partial: boolean) {
  if (count >= MANY) return `mais de ${MANY} ${many}`;
  const amount = `${partial ? 'pelo menos ' : ''}${count.toLocaleString('pt-BR')}`;
  return `${amount} ${count === 1 ? one : many}`;
}

/**
 * The warning shown while the weather model reports rain: it points people to the places that
 * already flooded (Defesa Civil) and the areas that can flood (flood model). It never says water
 * is on the street: neither source observes that.
 *
 * @param features records of the area on screen (only the flood ones are used)
 * @param recorded records loaded so far, used to find the closest place that already flooded
 * @param truncated the source returned only part of the area
 */
export function rainAlert(
  status: 'raining' | 'dry' | 'stale' | 'unknown',
  features: readonly UrbanFeature[],
  recorded: Iterable<UrbanFeature>,
  origin: Coordinates | null,
  truncated = false,
): RainAlert | null {
  if (status !== 'raining') return null;
  let historyCount = 0;
  let areaCount = 0;
  for (const { properties } of features) {
    if (properties.type === 'flood_history') historyCount++;
    else if (properties.type === 'flood_risk' || properties.type === 'flood_susceptibility')
      areaCount++;
  }

  let nearest: string | null = null;
  if (origin) {
    let best = Infinity;
    for (const feature of recorded) {
      if (feature.properties.type !== 'flood_history') continue;
      const location = pointOf(feature);
      if (!location) continue;
      const distance = straightDistanceMeters(origin, location);
      if (distance >= best || distance > NEAREST_MAX_METERS) continue;
      best = distance;
      nearest = `Perto de você já alagou: ${placeName(feature)}, a ${formatStraightDistance(distance)} em linha reta.`;
    }
  }

  const known = historyCount + areaCount;
  const parts = [
    historyCount > 0
      ? countText(historyCount, 'ponto onde já alagou', 'pontos onde já alagou', truncated)
      : null,
    areaCount > 0
      ? countText(areaCount, 'área que pode alagar', 'áreas que podem alagar', truncated)
      : null,
  ].filter((part): part is string => part !== null);
  const found = parts.join(' e ');
  const message =
    known > 0
      ? `${found.charAt(0).toUpperCase()}${found.slice(1)} nesta região, em destaque no mapa. Evite ficar nesses pontos e confira o local antes de passar. Não confirma água na via agora.`
      : 'O modelo meteorológico indica chuva aqui. Nenhum ponto de alagamento conhecido nesta área do mapa, o que não garante que a via esteja livre.';
  return {
    title: 'Está chovendo: atenção onde costuma alagar',
    message,
    nearest,
    historyCount,
    areaCount,
  };
}

/**
 * The same warning for a route: counts what lies within the route's 50 m band, as the API
 * assessed it. With a current, georeferenced occurrence it says so; otherwise it stays on
 * "history and model", which never confirm water on the way.
 */
export function routeRainAlert(
  status: 'raining' | 'dry' | 'stale' | 'unknown',
  assessment:
    | Pick<
        FloodRouteAssessment,
        | 'activeIncidentCount'
        | 'impassableIncidentCount'
        | 'historicalAreaCount'
        | 'modeledAreaCount'
      >
    | undefined,
): RainAlert | null {
  if (status !== 'raining') return null;
  const historyCount = assessment?.historicalAreaCount ?? 0;
  const areaCount = assessment?.modeledAreaCount ?? 0;
  const active = assessment?.activeIncidentCount ?? 0;
  const blocked = assessment?.impassableIncidentCount ?? 0;
  const parts = [
    historyCount > 0
      ? countText(historyCount, 'ponto onde já alagou', 'pontos onde já alagou', false)
      : null,
    areaCount > 0
      ? countText(areaCount, 'área que pode alagar', 'áreas que podem alagar', false)
      : null,
  ].filter((part): part is string => part !== null);
  const found = parts.join(' e ');
  let message: string;
  if (active > 0)
    message = `${countText(active, 'ocorrência atual', 'ocorrências atuais', false)} de alagamento perto do trajeto. Confira a fonte e a rota alternativa antes de continuar.`;
  else if (parts.length > 0)
    message = `${found.charAt(0).toUpperCase()}${found.slice(1)} perto do trajeto (faixa de 50 m). Redobre a atenção nesses trechos. Não confirma água na via agora.`;
  else
    message =
      'Nenhum ponto de alagamento conhecido perto do trajeto, o que não garante que a via esteja livre.';
  return {
    title:
      blocked > 0
        ? 'Está chovendo e há alagamento informado no trajeto'
        : 'Está chovendo: atenção onde costuma alagar',
    message,
    nearest: null,
    historyCount,
    areaCount,
  };
}
