import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';

type IconName = ComponentProps<typeof Feather>['name'];

export type DemoSceneCard = {
  icon: IconName;
  title: string;
  detail: string;
  tone?: 'danger' | 'success';
};
export type DemoScene = {
  map: 'home' | 'routes' | 'trip';
  emblem?: 'shield' | 'sos' | 'pin';
  cards?: DemoSceneCard[];
};
export type DemoAvailability = { tone: 'success' | 'warning'; label: string; note: string };
export type DemoAction =
  { kind: 'open'; label: string; href: Href } | { kind: 'walk'; hint: string };
export type DemoStep =
  | {
      kind: 'story';
      id: string;
      title: string;
      body: string;
      scene: DemoScene;
      availability?: DemoAvailability;
      action?: DemoAction;
    }
  | { kind: 'summary'; id: string; title: string; body: string };

const real = (note: string): DemoAvailability => ({
  tone: 'success',
  label: 'Funciona de verdade',
  note,
});
const simulated = (note: string): DemoAvailability => ({
  tone: 'warning',
  label: 'Simulado',
  note,
});

export const demoSteps: DemoStep[] = [
  {
    kind: 'story',
    id: 'inicio',
    title: 'Um app para quem anda a pé em São Paulo',
    body: 'Você planeja o caminho, escolhe quem acompanha e tem um SOS à mão. Veja cada parte em poucos passos.',
    scene: { map: 'routes', emblem: 'shield' },
  },
  {
    kind: 'story',
    id: 'destino',
    title: 'Diga para onde vai',
    body: 'Busque um endereço ou toque no mapa. O app calcula o caminho a pé e mostra o que os dados públicos dizem sobre a região, como iluminação, calçadas e alagamentos.',
    scene: {
      map: 'routes',
      cards: [
        {
          icon: 'navigation',
          title: 'Caminho a pé até a R. Frei Caneca',
          detail: '14 min, 1,1 km',
        },
      ],
    },
    availability: real(
      'Mapa, busca e rota. Na primeira vez, o app pede autorização para usar os serviços de mapa. Ele não garante que um caminho seja seguro.',
    ),
    action: { kind: 'open', label: 'Abrir o mapa', href: '/inicio' },
  },
  {
    kind: 'story',
    id: 'contatos',
    title: 'Escolha quem acompanha',
    body: 'Só quem aceitou seu convite recebe o link da caminhada. Se preferir, você pode sair sem ninguém acompanhando.',
    scene: {
      map: 'home',
      cards: [
        { icon: 'user', title: 'Mãe', detail: 'Convite aceito', tone: 'success' },
        { icon: 'user', title: 'Ana', detail: 'Convite aceito', tone: 'success' },
      ],
    },
    availability: real(
      'Convite e link. WhatsApp e SMS abrem a conversa com o texto pronto, e é você quem toca em enviar.',
    ),
    action: { kind: 'open', label: 'Ver contatos', href: '/contatos' },
  },
  {
    kind: 'story',
    id: 'trajeto',
    title: 'Caminhe com alguém de olho',
    body: 'Quem você escolheu abre o link e vê o roteiro e a última posição recebida, com o horário. Ao encerrar, o link deixa de mostrar sua localização.',
    scene: {
      map: 'trip',
      cards: [
        {
          icon: 'clock',
          title: 'Última posição recebida',
          detail: 'Às 19:42, pode estar desatualizada',
        },
      ],
    },
    availability: real(
      'Com o GPS autorizado por você. Na caminhada de teste, a posição é fictícia.',
    ),
    action: {
      kind: 'walk',
      hint: 'Abre uma caminhada fictícia. Para retornar, use Voltar à apresentação, no fim da tela.',
    },
  },
  {
    kind: 'story',
    id: 'alertas',
    title: 'Se algo parecer errado, o app pergunta',
    body: 'Parou de repente ou atrasou? O app pergunta se está tudo bem. Sem resposta dentro do prazo, o alerta começa sozinho.',
    scene: {
      map: 'trip',
      cards: [
        {
          icon: 'alert-triangle',
          title: 'Está tudo bem?',
          detail: 'Você parou por alguns minutos',
          tone: 'danger',
        },
      ],
    },
    availability: real(
      'O prazo é controlado no servidor, mesmo que o celular feche o app. A parada e o atraso da caminhada de teste são simulados.',
    ),
    action: {
      kind: 'walk',
      hint: 'Na caminhada, toque em Simular parada ou Simular atraso.',
    },
  },
  {
    kind: 'story',
    id: 'sos',
    title: 'SOS: segure o botão para pedir ajuda',
    body: 'O app avisa por e-mail os contatos que autorizaram e mostra a situação de cada aviso, sem afirmar que a mensagem foi lida.',
    scene: {
      map: 'trip',
      emblem: 'sos',
      cards: [
        {
          icon: 'mail',
          title: 'Alerta ativo',
          detail: 'Nesta demonstração nada é enviado',
          tone: 'danger',
        },
      ],
    },
    availability: {
      tone: 'warning',
      label: 'Em parte simulado',
      note: 'O alerta e o e-mail são reais em uma conta configurada. Smart Sampa, câmeras, GCM e mensagens automáticas de WhatsApp ou SMS ainda não estão integrados.',
    },
    action: { kind: 'walk', hint: 'Na caminhada, mantenha o botão SOS pressionado.' },
  },
  {
    kind: 'story',
    id: 'pin',
    title: 'Só você encerra, com seu PIN',
    body: 'Encerrar a caminhada ou cancelar um alerta exige o PIN. Sob ameaça, um segundo PIN parece encerrar normalmente, mas sinaliza um alerta silencioso a quem tem o link.',
    scene: { map: 'home', emblem: 'pin' },
    availability: real('PIN e PIN de coação. O PIN desta conta de teste é 1234.'),
    action: { kind: 'walk', hint: 'Na caminhada, toque em Cheguei ao destino e digite o PIN.' },
  },
  {
    kind: 'story',
    id: 'relatos',
    title: 'Conte o que viu na rua',
    body: 'Marque o ponto no mapa e descreva o problema, como calçada quebrada ou rua escura. Você decide se compartilha, e outras pessoas podem confirmar.',
    scene: {
      map: 'home',
      cards: [
        { icon: 'plus-circle', title: 'Calçada quebrada', detail: 'R. Augusta, confirmado por 2' },
      ],
    },
    availability: real('O relato fica salvo. Ele não é verificado oficialmente nem vai ao SP156.'),
    action: { kind: 'open', label: 'Fazer um relato', href: '/relatar' },
  },
  {
    kind: 'story',
    id: 'prefeitura',
    title: 'Um painel para a Prefeitura',
    body: 'A proposta é reunir relatos e dados públicos para mostrar à gestão da cidade onde agir primeiro.',
    scene: {
      map: 'home',
      cards: [
        {
          icon: 'bar-chart-2',
          title: 'Pontos críticos da região',
          detail: 'Dados fictícios',
        },
      ],
    },
    availability: simulated('Dados fictícios, sem câmeras reais e sem despacho da GCM.'),
    action: { kind: 'open', label: 'Ver o painel', href: '/prefeitura' },
  },
  {
    kind: 'summary',
    id: 'resumo',
    title: 'O que já funciona e o que é simulado',
    body: 'A conta de teste é isolada. Pode explorar à vontade.',
  },
];

export const demoRealFeatures = [
  'Mapa, busca de endereços e rota a pé',
  'Contatos, convites e link de acompanhamento',
  'GPS e alertas com prazo controlado no servidor',
  'PIN e PIN de coação',
  'Relatos e dados públicos da região',
];

export const demoSimulatedFeatures = [
  'Smart Sampa e câmeras',
  'Despacho da GCM',
  'Envio de relatos ao SP156',
  'Painel da Prefeitura',
  'Risco colorido por rua',
];

export function demoStepIndex(id: string | undefined): number {
  return Math.max(
    0,
    demoSteps.findIndex((step) => step.id === id),
  );
}
