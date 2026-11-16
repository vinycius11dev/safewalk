import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FloodRouteAssessment, RealRoute } from '@safewalk/contracts';
import {
  dayPeriod,
  hotspotExclusions,
  markFewestRecords,
  scoreRouteRecords,
  type KnownRecord,
  type ScoreRouteInput,
} from './route-records-score.js';

// 22:00 em São Paulo: período "noite".
const night = new Date('2026-11-09T01:00:00.000Z');
const latitude = -23.56;
const start = -46.65;
const metersPerLongitude = 111_320 * Math.cos((-23.55 * Math.PI) / 180);
const lon = (meters: number): number => start + meters / metersPerLongitude;

function route(lengthMeters = 1000, durationSeconds = 720, id = crypto.randomUUID()): RealRoute {
  return {
    id,
    durationSeconds,
    distanceMeters: lengthMeters,
    profile: 'pedestrian',
    walkingProfile: 'standard',
    geometry: {
      type: 'LineString',
      coordinates: [
        [start, latitude],
        [lon(lengthMeters), latitude],
      ],
    },
    instructions: [
      {
        text: 'Siga em frente',
        distanceMeters: lengthMeters,
        durationSeconds,
        beginPointIndex: 0,
        endPointIndex: 1,
      },
    ],
  } as RealRoute;
}
const crime = (overrides: Partial<Extract<KnownRecord, { kind: 'crime' }>> = {}): KnownRecord => ({
  kind: 'crime',
  category: 'robbery',
  occurredOn: '2026-10-01',
  period: 'night',
  longitude: lon(500),
  latitude,
  ...overrides,
});
const input = (overrides: Partial<ScoreRouteInput> = {}): ScoreRouteInput => ({
  route: route(),
  records: [],
  lamps: null,
  flood: undefined,
  coverage: { crime: 'available', crashes: 'available', truncated: false },
  sources: [],
  now: night,
  ...overrides,
});
const repeat = (count: number, record: () => KnownRecord): KnownRecord[] =>
  Array.from({ length: count }, record);

test('o período usa o horário de São Paulo', () => {
  assert.equal(dayPeriod(night), 'night');
  assert.equal(dayPeriod(new Date('2026-11-08T17:00:00.000Z')), 'afternoon');
  assert.equal(dayPeriod(new Date('2026-11-08T05:00:00.000Z')), 'dawn');
});

test('a mesma rua pesa mais no horário em que os crimes costumam ocorrer', () => {
  const sameHour = scoreRouteRecords(
    input({ records: repeat(4, () => crime({ period: 'night' })) }),
  );
  const otherHour = scoreRouteRecords(
    input({ records: repeat(4, () => crime({ period: 'morning' })) }),
  );
  assert.ok(sameHour.points > otherHour.points * 3);
});

test('registro fora da faixa do percurso não entra na conta', () => {
  const far = 150 / 111_320;
  const reading = scoreRouteRecords(input({ records: [crime({ latitude: latitude + far })] }));
  assert.equal(reading.points, 0);
  assert.equal(reading.factors.length, 0);
});

test('sem a base criminal a leitura se declara insuficiente', () => {
  const reading = scoreRouteRecords(
    input({
      coverage: { crime: 'missing', crashes: 'available', truncated: false },
      records: [
        {
          kind: 'pedestrian_crash',
          severity: 'injury',
          occurredOn: '2026-01-10',
          longitude: lon(100),
          latitude,
        },
      ],
    }),
  );
  assert.equal(reading.level, 'insufficient');
  assert.ok(reading.missingData.some((item) => item.includes('SSP')));
});

test('relato ganha peso com confirmações e perde quando não é encontrado', () => {
  const report = (confirmations: number, notFound: number): KnownRecord => ({
    kind: 'community_report',
    confirmations,
    notFound,
    resolved: 0,
    longitude: lon(300),
    latitude,
  });
  const points = (record: KnownRecord): number =>
    scoreRouteRecords(input({ records: [record] })).points;
  assert.ok(points(report(3, 0)) > points(report(0, 0)));
  assert.equal(points(report(0, 2)), 0);
});

test('o perfil noturno aumenta o peso dos crimes', () => {
  const nightProfile = { ...route(), walkingProfile: 'night' as const };
  const standard = scoreRouteRecords(input({ records: [crime()] }));
  const profiled = scoreRouteRecords(input({ route: nightProfile, records: [crime()] }));
  assert.ok(profiled.points > standard.points);
});

test('falta de luminária só conta à noite e quando o cadastro cobre o percurso', () => {
  const lampsAt = (meters: number[]) =>
    meters.map((value) => ({ longitude: lon(value), latitude }));
  const covered = lampsAt([50, 250, 450, 650]);
  const day = new Date('2026-11-08T17:00:00.000Z');
  const dark = scoreRouteRecords(input({ lamps: covered }));
  assert.equal(dark.factors[0]?.kind, 'lighting');
  assert.equal(scoreRouteRecords(input({ lamps: covered, now: day })).factors.length, 0);
  const sparse = scoreRouteRecords(input({ lamps: lampsAt([50]) }));
  assert.equal(sparse.factors.length, 0);
  assert.ok(sparse.missingData.some((item) => item.includes('Iluminação')));
});

test('chuva sobre área com histórico e alagamento ativo somam pontos', () => {
  const flood = {
    weatherCondition: 'raining',
    historicalAreaCount: 2,
    modeledAreaCount: 0,
    activeIncidentCount: 1,
    impassableIncidentCount: 0,
  } as FloodRouteAssessment;
  assert.equal(scoreRouteRecords(input({ flood })).points, 4);
});

test('aponta o trecho com mais registros e o motivo', () => {
  const reading = scoreRouteRecords(input({ records: repeat(11, () => crime()) }));
  const [highlight] = reading.highlights;
  assert.equal(highlight?.level, 'many');
  assert.equal(highlight?.startMeters, 400);
  assert.equal(highlight?.instructionIndex, 0);
  assert.match(highlight?.reason ?? '', /11 roubos/);
});

function scored(points: number, durationSeconds: number): RealRoute {
  const base = route(1000, durationSeconds);
  return { ...base, recordsReading: { ...scoreRouteRecords(input({ route: base })), points } };
}

test('destaca a alternativa com menos pontos quando o desvio compensa', () => {
  const fast = scored(20, 600);
  const calm = scored(8, 720);
  const marked = markFewestRecords([fast, calm]);
  assert.equal(marked[1]?.recordsReading?.fewestRecords, true);
  assert.equal(marked[0]?.recordsReading?.fewestRecords, false);
});

test('não destaca diferença pequena nem desvio longo demais', () => {
  const close = markFewestRecords([scored(20, 600), scored(18, 700)]);
  assert.ok(close.every((item) => !item.recordsReading?.fewestRecords));
  const tooLong = markFewestRecords([scored(20, 600), scored(2, 1300)]);
  assert.ok(tooLong.every((item) => !item.recordsReading?.fewestRecords));
});

test('não pede para contornar pontos colados na origem ou no destino', () => {
  const endpoints = {
    ...route(),
    recordsReading: scoreRouteRecords(
      input({ records: repeat(9, () => crime({ longitude: lon(50) })) }),
    ),
  };
  assert.deepEqual(hotspotExclusions(endpoints), []);
  const middle = {
    ...route(),
    recordsReading: scoreRouteRecords(input({ records: repeat(9, () => crime()) })),
  };
  const [polygon] = hotspotExclusions(middle);
  assert.equal(polygon?.length, 5);
  assert.deepEqual(polygon?.[0], polygon?.[4]);
});
