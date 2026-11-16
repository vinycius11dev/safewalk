import type { RealRoute } from '@safewalk/contracts';
import { summarizeRouteContext } from './route-context-summary';

/** Evidence review, not a risk score: missing coverage must never become a positive assessment. */
export function routeEvidence(
  route: Pick<RealRoute, 'context' | 'preference' | 'profile' | 'walkingProfile' | 'wheelchair'>,
) {
  const summary = summarizeRouteContext(route);
  const features = route.context?.nearbyFeatures ?? [];
  const historicalFloods = features.filter((f) =>
    ['flood_history', 'flood_risk', 'flood_susceptibility'].includes(f.properties.type),
  ).length;
  const floodRecords = features.filter((f) => f.properties.type === 'floods').length;
  const stale = route.context?.sources.some((s) => s.status === 'stale') ?? false;
  const safety: string[] = [];
  if (historicalFloods)
    safety.push(
      `${historicalFloods} registros de histórico ou suscetibilidade a inundação próximos; não comprovam alagamento ativo.`,
    );
  if (floodRecords)
    safety.push(
      `${floodRecords} registros de alagamento próximos. Confira situação e data na fonte antes de sair.`,
    );
  if (summary.sp156)
    safety.push(
      `${summary.sp156} solicitações SP156 próximas; abertura de chamado não confirma que o problema continue no local.`,
    );
  if (summary.lighting)
    safety.push(
      `${summary.lighting} pontos de iluminação cadastrados. Não confirma luz acesa no horário do trajeto.`,
    );
  const widths = features.flatMap((f) =>
    f.properties.type === 'sidewalks' &&
    typeof f.properties.details.minimumWidthMeters === 'number' &&
    f.properties.details.minimumWidthMeters > 0
      ? [f.properties.details.minimumWidthMeters]
      : [],
  );
  const inclines = features.flatMap((f) =>
    f.properties.type === 'sidewalks' &&
    typeof f.properties.details.maximumInclinePercent === 'number'
      ? [f.properties.details.maximumInclinePercent]
      : [],
  );
  const accessibility: string[] = [];
  if (route.profile === 'auto')
    accessibility.push(
      'Perfil de carro: esta leitura não avalia o acesso a pé entre o estacionamento e o destino.',
    );
  if (route.preference === 'step_free')
    accessibility.push(
      'Foi solicitado evitar escadas ao provedor. Rampas, elevadores e continuidade do passeio precisam ser conferidos.',
    );
  // Explains the calculation, not the street: it never replaces the "missing data" notice.
  const profileNotes = route.wheelchair
    ? [
        'Você informou uma pessoa em cadeira de rodas: tempo estimado em ritmo calmo (3,6 km/h) e ladeiras evitadas quando há alternativa.',
      ]
    : route.walkingProfile === 'pcd'
      ? [
          'Perfil idoso ou PCD: tempo estimado em ritmo calmo (3,6 km/h) e ladeiras evitadas quando há alternativa.',
        ]
      : route.walkingProfile === 'child'
        ? [
            'Perfil criança: o cálculo prefere calçadas e caminhos de pedestre e evita vielas e acessos de garagem.',
          ]
        : [];
  if (summary.sidewalks)
    accessibility.push(
      `${summary.sidewalks} trechos de calçada cadastrados próximos. O cadastro não comprova piso regular ou percurso contínuo.`,
    );
  if (widths.length)
    accessibility.push(
      `Menor largura cadastrada nos trechos próximos: ${Math.min(...widths).toLocaleString('pt-BR')} m. Pode não corresponder ao lado percorrido.`,
    );
  if (inclines.length)
    accessibility.push(
      `Maior declividade cadastrada nos trechos próximos: ${Math.max(...inclines).toLocaleString('pt-BR')}%.`,
    );
  if (summary.crossings)
    accessibility.push(
      `${summary.crossings} semáforos cadastrados próximos; rebaixamento de guia e sinal sonoro não confirmados.`,
    );
  const attention = historicalFloods + floodRecords + summary.sp156 > 0;
  return {
    attention,
    summary: summary.empty
      ? 'Faltam dados para avaliar este percurso'
      : attention
        ? 'Registros próximos para conferir'
        : 'Leitura parcial dos dados disponíveis',
    safety: safety.length
      ? safety
      : ['Sem dados suficientes para avaliar a segurança deste percurso.'],
    accessibility: [
      ...(accessibility.length
        ? accessibility
        : ['Sem dados suficientes sobre calçadas, rampas e travessias deste percurso.']),
      ...profileNotes,
    ],
    checkedAt: route.context?.checkedAt ?? null,
    stale,
    sources: route.context?.sources ?? [],
    notice:
      'Leitura automática em uma faixa aproximada de 50 m. Cobertura parcial; não certifica segurança ou acessibilidade de toda a rota.',
  };
}
