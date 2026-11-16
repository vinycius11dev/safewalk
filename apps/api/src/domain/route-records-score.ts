import type {
  FloodRouteAssessment,
  RealRoute,
  RouteDayPeriod,
  RouteRecordsLevel,
  RouteRecordsReading,
  WalkingProfile,
} from '@safewalk/contracts';

export type CrimeCategory = 'robbery' | 'theft' | 'assault' | 'sexual';
export type RecordLocation = { longitude: number; latitude: number };
export type KnownRecord = RecordLocation &
  (
    | {
        kind: 'crime';
        category: CrimeCategory;
        /** Data da ocorrência em `YYYY-MM-DD`. */
        occurredOn: string;
        period: RouteDayPeriod | null;
      }
    | {
        kind: 'pedestrian_crash';
        severity: 'fatal' | 'injury' | 'notification';
        occurredOn: string;
      }
    | { kind: 'community_report'; confirmations: number; notFound: number; resolved: number }
    | { kind: 'infrastructure' }
  );

export type RouteRecordsCoverage = {
  crime: 'available' | 'stale' | 'missing';
  crashes: 'available' | 'stale' | 'missing';
  truncated: boolean;
};

type Factor = RouteRecordsReading['factors'][number];
type FactorKind = Factor['kind'];

const metersPerLatitude = 111_320;
const metersPerLongitude = metersPerLatitude * Math.cos((-23.55 * Math.PI) / 180);
const gridCellMeters = 200;
const minimumBinMeters = 200;
const maximumBins = 60;
const dayMs = 86_400_000;

/** Distância máxima, em metros, em que cada tipo de registro é associado ao percurso. */
export const recordBufferMeters: Record<KnownRecord['kind'], number> = {
  crime: 100,
  pedestrian_crash: 100,
  // A coordenada pública do relato é arredondada a cerca de 110 m.
  community_report: 150,
  infrastructure: 50,
};
export const lampBufferMeters = 50;

const crimeWeights: Record<CrimeCategory, number> = {
  robbery: 1,
  theft: 0.5,
  assault: 0.8,
  sexual: 1.2,
};
const crashWeights = { fatal: 1, injury: 0.6, notification: 0.25 };
const dayPeriods: RouteDayPeriod[] = ['dawn', 'morning', 'afternoon', 'night'];
const periodLabels: Record<RouteDayPeriod, string> = {
  dawn: 'de madrugada',
  morning: 'de manhã',
  afternoon: 'à tarde',
  night: 'à noite',
};

/**
 * Pontos por quilômetro e por trecho calibrados com percursos de 1 km sorteados na capital:
 * "poucos" fica até a mediana da cidade e "muitos" acima do percentil 85.
 */
export const routeLevelLimits = { somePerKm: 22, manyPerKm: 49 };
/** Um trecho de 200 m usa a mesma densidade da cidade, na proporção do seu tamanho. */
export const binLevelLimits = {
  some: routeLevelLimits.somePerKm / 5,
  many: routeLevelLimits.manyPerKm / 5,
};

/** Alternativa só recebe destaque se evitar 15% dos pontos sem aumentar demais a caminhada. */
export const fewestRecordsRule = {
  maximumShareOfBaseline: 0.85,
  maximumDurationRatio: 1.35,
  maximumExtraSeconds: 480,
};

const notice =
  'Leitura automática de registros oficiais e relatos perto do percurso. Mostra o que já foi registrado, não prevê o que vai acontecer e não indica que um caminho seja seguro. A SSP não publica o local de crimes sexuais, que por isso não entram na conta. Em emergência, ligue 190.';

export function dayPeriod(date: Date): RouteDayPeriod {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(date),
  );
  return dayPeriods[Math.floor(hour / 6)] ?? 'night';
}

function periodWeight(record: RouteDayPeriod | null, current: RouteDayPeriod): number {
  if (record === null) return 0.4;
  const distance = Math.abs(dayPeriods.indexOf(record) - dayPeriods.indexOf(current));
  if (distance === 0) return 1;
  return distance === 2 ? 0.25 : 0.5;
}

function crimeRecency(occurredOn: string, now: number): number {
  const months = (now - Date.parse(`${occurredOn}T12:00:00Z`)) / (30.44 * dayMs);
  if (months <= 6) return 1;
  if (months <= 12) return 0.8;
  return months <= 24 ? 0.5 : 0.25;
}

function crashRecency(occurredOn: string, now: number): number {
  const months = (now - Date.parse(`${occurredOn}T12:00:00Z`)) / (30.44 * dayMs);
  if (months > 60) return 0;
  if (months <= 12) return 1;
  return months <= 36 ? 0.6 : 0.3;
}

const communityWeight = (record: Extract<KnownRecord, { kind: 'community_report' }>): number =>
  Math.min(
    1.5,
    Math.max(0, 0.5 + 0.25 * record.confirmations - 0.25 * (record.notFound + record.resolved)),
  );

function recordWeight(record: KnownRecord, period: RouteDayPeriod, now: number): number {
  switch (record.kind) {
    case 'crime':
      return (
        crimeWeights[record.category] *
        periodWeight(record.period, period) *
        crimeRecency(record.occurredOn, now)
      );
    case 'pedestrian_crash':
      return crashWeights[record.severity] * crashRecency(record.occurredOn, now);
    case 'community_report':
      return communityWeight(record);
    case 'infrastructure':
      return 0.1;
  }
}

/** O perfil salvo muda o peso do que mais pesa para aquela pessoa, nunca a origem dos dados. */
function profileMultiplier(kind: FactorKind, profile: WalkingProfile | undefined): number {
  if (profile === 'night' && (kind === 'crime' || kind === 'lighting')) return 1.25;
  if (profile === 'pcd' && kind === 'infrastructure') return 2;
  if (profile === 'pcd' && kind === 'flood') return 1.5;
  if (profile === 'child' && kind === 'pedestrian_crash') return 1.5;
  return 1;
}

type Piece = {
  ax: number;
  ay: number;
  dx: number;
  dy: number;
  length: number;
  startMeters: number;
};
const projectX = (longitude: number): number => longitude * metersPerLongitude;
const projectY = (latitude: number): number => latitude * metersPerLatitude;
const cell = (value: number): number => Math.floor(value / gridCellMeters);

class RouteLine {
  readonly pieces: Piece[] = [];
  readonly vertexMeters: number[] = [0];
  readonly length: number;
  private readonly grid = new Map<string, Piece[]>();

  constructor(coordinates: RealRoute['geometry']['coordinates']) {
    let travelled = 0;
    for (let index = 1; index < coordinates.length; index++) {
      const a = coordinates[index - 1]!;
      const b = coordinates[index]!;
      const ax = projectX(a[0]);
      const ay = projectY(a[1]);
      const dx = projectX(b[0]) - ax;
      const dy = projectY(b[1]) - ay;
      const length = Math.hypot(dx, dy);
      const piece = { ax, ay, dx, dy, length, startMeters: travelled };
      this.pieces.push(piece);
      travelled += length;
      this.vertexMeters.push(travelled);
      for (let x = cell(Math.min(ax, ax + dx)); x <= cell(Math.max(ax, ax + dx)); x++)
        for (let y = cell(Math.min(ay, ay + dy)); y <= cell(Math.max(ay, ay + dy)); y++) {
          const key = `${x}:${y}`;
          const list = this.grid.get(key);
          if (list) list.push(piece);
          else this.grid.set(key, [piece]);
        }
    }
    this.length = travelled;
  }

  /** Posição ao longo do percurso do trecho mais próximo, ou `null` fora da faixa. */
  alongMeters(location: RecordLocation, bufferMeters: number): number | null {
    const x = projectX(location.longitude);
    const y = projectY(location.latitude);
    let best = bufferMeters ** 2;
    let along: number | null = null;
    for (let cx = cell(x) - 1; cx <= cell(x) + 1; cx++)
      for (let cy = cell(y) - 1; cy <= cell(y) + 1; cy++)
        for (const piece of this.grid.get(`${cx}:${cy}`) ?? []) {
          const lengthSquared = piece.dx ** 2 + piece.dy ** 2;
          const fraction = lengthSquared
            ? Math.max(
                0,
                Math.min(
                  1,
                  ((x - piece.ax) * piece.dx + (y - piece.ay) * piece.dy) / lengthSquared,
                ),
              )
            : 0;
          const distance =
            (x - piece.ax - fraction * piece.dx) ** 2 + (y - piece.ay - fraction * piece.dy) ** 2;
          if (distance <= best) {
            best = distance;
            along = piece.startMeters + fraction * piece.length;
          }
        }
    return along;
  }
}

type LabelKey =
  CrimeCategory | 'fatal' | 'injury' | 'notification' | 'community' | 'infrastructure' | 'unlit';
const labels: Record<LabelKey, [string, string]> = {
  robbery: ['roubo', 'roubos'],
  theft: ['furto', 'furtos'],
  assault: ['caso de violência física', 'casos de violência física'],
  sexual: ['crime sexual', 'crimes sexuais'],
  fatal: ['atropelamento fatal', 'atropelamentos fatais'],
  injury: ['atropelamento com vítima', 'atropelamentos com vítima'],
  notification: ['notificação de atropelamento', 'notificações de atropelamento'],
  community: ['relato da comunidade', 'relatos da comunidade'],
  infrastructure: ['chamado no SP156', 'chamados no SP156'],
  unlit: ['trecho sem luminária cadastrada', 'trechos sem luminária cadastrada'],
};
const labelKey = (record: KnownRecord): LabelKey => {
  if (record.kind === 'crime') return record.category;
  if (record.kind === 'pedestrian_crash') return record.severity;
  return record.kind === 'community_report' ? 'community' : 'infrastructure';
};
function joinCounts(counts: Map<LabelKey, number>): string {
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key, count]) => `${count} ${labels[key][count === 1 ? 0 : 1]}`);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)!}`;
}

type Bin = { points: number; counts: Map<LabelKey, number>; lit: boolean };
const round = (value: number): number => Math.round(value * 100) / 100;
const binLevel = (points: number): RouteRecordsLevel =>
  points >= binLevelLimits.many ? 'many' : points >= binLevelLimits.some ? 'some' : 'few';

function instructionAt(route: RealRoute, line: RouteLine, meters: number): number | null {
  const index = route.instructions.findIndex((step) => {
    const start = line.vertexMeters[step.beginPointIndex];
    const end = line.vertexMeters[step.endPointIndex];
    return start !== undefined && end !== undefined && meters >= start && meters <= end;
  });
  return index === -1 ? null : index;
}

export type ScoreRouteInput = {
  route: RealRoute;
  records: KnownRecord[];
  /** Luminárias cadastradas já carregadas; `null` quando a fonte não está disponível. */
  lamps: RecordLocation[] | null;
  flood: FloodRouteAssessment | undefined;
  coverage: RouteRecordsCoverage;
  sources: RouteRecordsReading['sources'];
  now: Date;
};

const floodPoints = (
  flood: FloodRouteAssessment | undefined,
): { points: number; count: number } => {
  if (!flood) return { points: 0, count: 0 };
  const known = flood.historicalAreaCount + flood.modeledAreaCount;
  const rainCount = flood.weatherCondition === 'raining' ? Math.min(known, 6) : 0;
  return {
    points: 3 * flood.activeIncidentCount + 2 * flood.impassableIncidentCount + 0.5 * rainCount,
    count: flood.activeIncidentCount + rainCount,
  };
};

export function scoreRouteRecords(input: ScoreRouteInput): RouteRecordsReading {
  const { route, records, lamps, flood, coverage, sources, now } = input;
  const nowMs = now.getTime();
  const period = dayPeriod(now);
  const profile = route.walkingProfile;
  const line = new RouteLine(route.geometry.coordinates);
  const binMeters = Math.max(minimumBinMeters, line.length / maximumBins);
  const bins: Bin[] = Array.from(
    { length: Math.max(1, Math.ceil(line.length / binMeters)) },
    () => ({
      points: 0,
      counts: new Map<LabelKey, number>(),
      lit: false,
    }),
  );
  const binAt = (meters: number): Bin =>
    bins[Math.min(bins.length - 1, Math.floor(meters / binMeters))]!;
  const totals = new Map<
    FactorKind,
    { count: number; points: number; counts: Map<LabelKey, number> }
  >();
  const addTotal = (
    kind: FactorKind,
    key: LabelKey | null,
    count: number,
    points: number,
  ): void => {
    const total = totals.get(kind) ?? { count: 0, points: 0, counts: new Map<LabelKey, number>() };
    total.count += count;
    total.points += points;
    if (key) total.counts.set(key, (total.counts.get(key) ?? 0) + count);
    totals.set(kind, total);
  };
  const infrastructureByBin = new Map<Bin, number>();

  for (const record of records) {
    const along = line.alongMeters(record, recordBufferMeters[record.kind]);
    if (along === null) continue;
    const factor: FactorKind = record.kind;
    const raw = recordWeight(record, period, nowMs) * profileMultiplier(factor, profile);
    if (raw <= 0) continue;
    const bin = binAt(along);
    let points = raw;
    if (factor === 'infrastructure') {
      // Muitos chamados na mesma quadra indicam zeladoria, não um risco que cresce sem limite.
      const used = infrastructureByBin.get(bin) ?? 0;
      points = Math.max(0, Math.min(raw, 0.5 * profileMultiplier(factor, profile) - used));
      infrastructureByBin.set(bin, used + points);
    }
    const key = labelKey(record);
    bin.points += points;
    bin.counts.set(key, (bin.counts.get(key) ?? 0) + 1);
    addTotal(factor, key, 1, points);
  }

  const dark = period === 'night' || period === 'dawn' || profile === 'night';
  let lightingKnown = false;
  if (lamps) {
    for (const lamp of lamps) {
      const along = line.alongMeters(lamp, lampBufferMeters);
      if (along !== null) binAt(along).lit = true;
    }
    // Só uma cobertura ampla permite tratar a ausência de luminária como dado, não como lacuna.
    lightingKnown = bins.filter((bin) => bin.lit).length / bins.length >= 0.6;
  }
  if (dark && lightingKnown) {
    const points = 0.5 * profileMultiplier('lighting', profile);
    for (const bin of bins) {
      if (bin.lit) continue;
      bin.points += points;
      bin.counts.set('unlit', 1);
      addTotal('lighting', 'unlit', 1, points);
    }
  }

  const floodScore = floodPoints(flood);
  if (floodScore.points > 0)
    addTotal(
      'flood',
      null,
      floodScore.count,
      floodScore.points * profileMultiplier('flood', profile),
    );

  const points = [...totals.values()].reduce((sum, total) => sum + total.points, 0);
  const pointsPerKm = points / Math.max(0.3, line.length / 1000);
  const level: RouteRecordsReading['level'] =
    coverage.crime === 'missing'
      ? 'insufficient'
      : pointsPerKm >= routeLevelLimits.manyPerKm
        ? 'many'
        : pointsPerKm >= routeLevelLimits.somePerKm
          ? 'some'
          : 'few';

  const factorIntro: Record<FactorKind, string> = {
    crime: `Boletins da SSP-SP a até ${recordBufferMeters.crime} m. Ocorrências ${periodLabels[period]} pesam mais`,
    pedestrian_crash: `Registros do Infosiga a até ${recordBufferMeters.pedestrian_crash} m`,
    community_report: 'Relatos ativos, com peso maior quando outras pessoas confirmam',
    flood: 'Alagamentos atuais ou áreas com histórico durante chuva estimada',
    infrastructure: 'Solicitações públicas sobre calçada, luz ou zeladoria',
    lighting: 'Cadastro de iluminação; não confirma luz acesa',
  };
  const factors = [...totals.entries()]
    .map(([kind, total]) => {
      const detail = joinCounts(total.counts);
      return {
        kind,
        count: total.count,
        points: round(total.points),
        summary: (detail ? `${detail}. ${factorIntro[kind]}.` : `${factorIntro[kind]}.`).slice(
          0,
          300,
        ),
      };
    })
    .sort((a, b) => b.points - a.points);

  const highlights = bins
    .map((bin, index) => ({ bin, index }))
    .filter(({ bin }) => bin.points > 0 && bin.counts.size > 0 && binLevel(bin.points) !== 'few')
    .sort((a, b) => b.bin.points - a.bin.points)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map(({ bin, index }) => {
      const startMeters = Math.round(index * binMeters);
      const endMeters = Math.round(Math.min(line.length, (index + 1) * binMeters));
      return {
        startMeters,
        endMeters,
        level: binLevel(bin.points),
        reason: `${joinCounts(bin.counts)} perto deste trecho.`.slice(0, 300),
        instructionIndex: instructionAt(route, line, (startMeters + endMeters) / 2),
      };
    });

  const missingData: string[] = [];
  if (coverage.crime === 'missing') missingData.push('Dados criminais da SSP-SP não importados.');
  if (coverage.crime === 'stale') missingData.push('Dados criminais da SSP-SP desatualizados.');
  if (coverage.crashes === 'missing') missingData.push('Dados do Infosiga não importados.');
  if (coverage.crashes === 'stale') missingData.push('Dados do Infosiga desatualizados.');
  if (coverage.truncated)
    missingData.push('Parte dos registros não foi analisada por limite de processamento.');
  if (dark && !lightingKnown)
    missingData.push('Iluminação cadastrada ainda não carregada em todo o percurso.');

  return {
    method: 'known_records_rules_v1',
    level,
    points: round(points),
    pointsPerKm: round(pointsPerKm),
    period,
    factors,
    highlights,
    fewestRecords: false,
    missingData,
    sources,
    notice,
    evaluatedAt: now.toISOString(),
  };
}

/** Marca a alternativa com menos pontos quando a diferença é real e o desvio é razoável. */
export function markFewestRecords(routes: RealRoute[]): RealRoute[] {
  const scored = routes.filter(
    (route) => route.recordsReading && route.recordsReading.level !== 'insufficient',
  );
  if (scored.length < 2) return routes;
  const fastest = Math.min(...scored.map((route) => route.durationSeconds));
  const reachable = scored.filter(
    (route) =>
      route.durationSeconds <= fastest * fewestRecordsRule.maximumDurationRatio &&
      route.durationSeconds <= fastest + fewestRecordsRule.maximumExtraSeconds,
  );
  const pointsOf = (route: RealRoute): number => route.recordsReading!.points;
  const preferred = [...reachable].sort(
    (a, b) => pointsOf(a) - pointsOf(b) || a.durationSeconds - b.durationSeconds,
  )[0];
  if (!preferred) return routes;
  // A referência é a rota mais rápida, que a pessoa pegaria sem esta comparação.
  const quickest = [...scored].sort((a, b) => a.durationSeconds - b.durationSeconds)[0]!;
  const baseline =
    preferred.id === quickest.id
      ? Math.min(...scored.filter((route) => route.id !== preferred.id).map(pointsOf))
      : pointsOf(quickest);
  if (pointsOf(preferred) > baseline * fewestRecordsRule.maximumShareOfBaseline) return routes;
  return routes.map((route) =>
    route.id === preferred.id
      ? { ...route, recordsReading: { ...route.recordsReading!, fewestRecords: true } }
      : route,
  );
}

function pointAlong(route: RealRoute, meters: number): RecordLocation {
  const line = new RouteLine(route.geometry.coordinates);
  const piece =
    line.pieces.find((item) => meters <= item.startMeters + item.length) ?? line.pieces.at(-1)!;
  const fraction = piece.length ? Math.min(1, (meters - piece.startMeters) / piece.length) : 0;
  return {
    longitude: (piece.ax + fraction * piece.dx) / metersPerLongitude,
    latitude: (piece.ay + fraction * piece.dy) / metersPerLatitude,
  };
}

/**
 * Áreas a contornar ao pedir uma alternativa: os trechos com mais registros, exceto perto da
 * origem e do destino, porque o provedor não encontra caminho quando eles ficam excluídos.
 */
export function hotspotExclusions(route: RealRoute, halfSizeMeters = 60): [number, number][][] {
  const reading = route.recordsReading;
  if (!reading || reading.level === 'insufficient') return [];
  const endpointMargin = 250;
  const line = new RouteLine(route.geometry.coordinates);
  return reading.highlights
    .map((item) => (item.startMeters + item.endMeters) / 2)
    .filter((meters) => meters > endpointMargin && meters < line.length - endpointMargin)
    .map((meters) => {
      const { longitude, latitude } = pointAlong(route, meters);
      const dx = halfSizeMeters / metersPerLongitude;
      const dy = halfSizeMeters / metersPerLatitude;
      return [
        [longitude - dx, latitude - dy],
        [longitude + dx, latitude - dy],
        [longitude + dx, latitude + dy],
        [longitude - dx, latitude + dy],
        [longitude - dx, latitude - dy],
      ];
    });
}
