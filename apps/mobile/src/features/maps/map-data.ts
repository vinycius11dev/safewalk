import type { Coordinates, UrbanFeature, UrbanLayerType } from '@safewalk/contracts';
export const layerLabels: Record<UrbanLayerType, string> = {
  sidewalks: 'Calçadas cadastradas',
  lighting: 'Iluminação cadastrada',
  crossings: 'Cruzamentos semaforizados',
  flood_history: 'Histórico de alagamento',
  flood_risk: 'Áreas suscetíveis a inundação',
  flood_susceptibility: 'Suscetibilidade a inundação · SGB',
  accessibility: 'Selos de acessibilidade',
  health: 'Hospitais',
  police: 'Delegacias',
  sp156: 'Histórico do SP156',
  pedestrian_crashes: 'Sinistros e notificações históricas · InfoSiga',
  floods: 'Alagamentos do CGE',
  weather: 'Chuva · modelo meteorológico',
};

/** Round-robin prevents a dense source from hiding other selected layers. */
export function limitMapFeatures(features: readonly UrbanFeature[], limit: number): UrbanFeature[] {
  if (limit <= 0) return [];
  const groups = new Map<UrbanLayerType, { items: UrbanFeature[]; next: number }>();
  for (const feature of features) {
    let group = groups.get(feature.properties.type);
    if (!group) {
      group = { items: [], next: 0 };
      groups.set(feature.properties.type, group);
    }
    group.items.push(feature);
  }
  const result: UrbanFeature[] = [];
  while (result.length < limit) {
    let added = false;
    for (const group of groups.values()) {
      const feature = group.items[group.next];
      if (feature) {
        result.push(feature);
        group.next++;
        added = true;
        if (result.length === limit) break;
      }
    }
    if (!added) break;
  }
  return result;
}
export function featureLocation(feature: UrbanFeature): Coordinates {
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      west = Math.min(west, value[0]);
      east = Math.max(east, value[0]);
      south = Math.min(south, value[1]);
      north = Math.max(north, value[1]);
    } else value.forEach(visit);
  };
  visit(feature.geometry.coordinates);
  return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}
export function readableDate(value: string | null | undefined): string {
  return value
    ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'Data não informada pela fonte';
}
export function readableObservation(value: string | null | undefined, sourceId: string): string {
  if (!value) return 'Data não informada pela fonte';
  return sourceId.startsWith('geosampa') ||
    sourceId === 'cge-floods' ||
    sourceId === 'sp156' ||
    sourceId === 'infosiga'
    ? value.slice(0, 10).split('-').reverse().join('/')
    : readableDate(value);
}
export function featureSubtitle(feature: UrbanFeature): string {
  const data = feature.properties.details;
  if (typeof data.minimumWidthMeters === 'number')
    return `Largura mínima cadastrada: ${data.minimumWidthMeters.toLocaleString('pt-BR')} m`;
  if (typeof data.address === 'string') return data.address;
  return layerLabels[feature.properties.type];
}

export function featureExplanation(feature: UrbanFeature): string {
  const { type, details } = feature.properties;
  if (type === 'pedestrian_crashes') {
    const kind =
      details.recordType === 'NOTIFICACAO'
        ? 'Notificação histórica; a fonte não confirma o sinistro.'
        : details.recordType === 'SINISTRO FATAL'
          ? 'Sinistro fatal histórico envolvendo pedestre; a fonte não identifica quem foi vítima fatal.'
          : details.recordType === 'SINISTRO NAO FATAL'
            ? 'Sinistro histórico não fatal envolvendo pedestre.'
            : 'Registro histórico envolvendo pedestre.';
    return `${kind} Coordenadas da fonte com precisão desconhecida. Não indica risco atual.`;
  }
  if (type === 'flood_susceptibility') {
    const level =
      typeof details.susceptibilityClass === 'string' ? details.susceptibilityClass : null;
    const year = typeof details.studyYear === 'number' ? details.studyYear : null;
    return `Carta de suscetibilidade a inundação do SGB${level ? ` · classe ${level}` : ''}${year ? ` · ano indicado ${year}` : ''}. Não confirma alagamento agora.`;
  }
  if (type === 'sp156') {
    const subject =
      typeof details.subject === 'string' && details.subject.trim() ? details.subject.trim() : null;
    const service =
      typeof details.service === 'string' && details.service.trim() ? details.service.trim() : null;
    const status =
      typeof details.status === 'string' && details.status.trim() ? details.status.trim() : null;
    return [
      service ? `Serviço solicitado: ${service}.` : 'Solicitação registrada no SP156.',
      subject && subject !== service ? `Assunto: ${subject}.` : '',
      status ? `Situação do protocolo: ${status}.` : 'Situação do protocolo não informada.',
      'Condição atual não verificada.',
    ]
      .filter(Boolean)
      .join(' ');
  }
  const descriptions: Record<
    Exclude<UrbanLayerType, 'sp156' | 'flood_susceptibility' | 'pedestrian_crashes'>,
    string
  > = {
    sidewalks: 'Trecho de calçada cadastrado. Conservação e acessibilidade atuais não verificadas.',
    lighting: 'Ponto de iluminação cadastrado. O funcionamento atual não foi verificado.',
    crossings: 'Semáforo cadastrado. Funcionamento e acessibilidade atuais não foram verificados.',
    flood_history: 'Registro histórico de alagamento; não confirma alagamento agora.',
    flood_risk: 'Área de inundação modelada; não confirma água ou alagamento agora.',
    accessibility: 'Estabelecimento com selo cadastrado. Confira as condições atuais de acesso.',
    health:
      'Hospital cadastrado. Pronto-socorro, horário e atendimento não verificados; em emergência ligue 192.',
    police:
      'Delegacia cadastrada. Horário, plantão e atendimento não verificados; em emergência ligue 190.',
    floods: 'Informação de alagamento da fonte; confira a data e a situação informadas.',
    weather: 'Estimativa de chuva de modelo meteorológico; não detecta alagamentos.',
  };
  return descriptions[type];
}
