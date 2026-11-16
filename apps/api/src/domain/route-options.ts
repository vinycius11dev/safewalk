import type { RouteOption } from '@safewalk/contracts';

export const demoRouteOptions: RouteOption[] = [
  {
    kind: 'safer',
    durationMinutes: 17,
    distanceMeters: 1300,
    riskLabel: 'baixo',
    description: 'Ruas iluminadas, 3 câmeras e 1 ponto seguro',
    simulated: true,
    points: [
      { latitude: -23.5644, longitude: -46.6522 },
      { latitude: -23.5609, longitude: -46.6509 },
      { latitude: -23.5587, longitude: -46.6498 },
      { latitude: -23.5573, longitude: -46.6531 },
      { latitude: -23.5548, longitude: -46.652 },
    ],
  },
  {
    kind: 'faster',
    durationMinutes: 14,
    distanceMeters: 1100,
    riskLabel: 'alto',
    description: '2 roubos relatados na última hora e 1 trecho escuro',
    simulated: true,
    points: [
      { latitude: -23.5644, longitude: -46.6522 },
      { latitude: -23.56, longitude: -46.6531 },
      { latitude: -23.5548, longitude: -46.652 },
    ],
  },
];
