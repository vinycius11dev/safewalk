import { z } from 'zod';

export const municipalityCaseStateSchema = z.object({
  status: z.enum(['new', 'assigned', 'closed']),
  assignedAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  outcome: z.string().max(80).nullable(),
  note: z.string().max(280),
});
export type MunicipalityCaseState = z.infer<typeof municipalityCaseStateSchema>;
export const emptyCaseState: MunicipalityCaseState = {
  status: 'new',
  assignedAt: null,
  closedAt: null,
  outcome: null,
  note: '',
};
export const criticalPoints = [
  {
    id: 'augusta',
    street: 'R. Augusta × Av. Paulista',
    category: 'security',
    label: 'Roubo de celular',
    reports: 48,
    time: '18h–21h',
    cameras: 4,
    suggestion: 'Reforço de patrulha GCM',
    status: 'Em análise',
    icon: 'alert-circle' as const,
  },
  {
    id: 'augusta-1200',
    street: 'R. Augusta, 900–1300',
    category: 'security',
    label: 'Roubo de celular',
    reports: 31,
    time: '21h–0h',
    cameras: 2,
    suggestion: 'Patrulha e iluminação',
    status: 'Encaminhado',
    icon: 'alert-circle' as const,
  },
  {
    id: 'consolacao',
    street: 'R. da Consolação, 1500',
    category: 'security',
    label: 'Assédio',
    reports: 22,
    time: '18h–21h',
    cameras: 1,
    suggestion: 'Patrulha a pé',
    status: 'Encaminhado',
    icon: 'alert-triangle' as const,
  },
  {
    id: 'frei-caneca',
    street: 'R. Frei Caneca, 300–600',
    category: 'maintenance',
    label: 'Calçada quebrada',
    reports: 17,
    time: 'Todo o dia',
    cameras: 3,
    suggestion: 'Reparo via SP156',
    status: 'Em execução',
    icon: 'tool' as const,
  },
  {
    id: 'peixoto',
    street: 'R. Peixoto Gomide',
    category: 'maintenance',
    label: 'Rua sem luz',
    reports: 12,
    time: '18h–6h',
    cameras: 0,
    suggestion: 'Troca de lâmpadas via SP156',
    status: 'Aberto',
    icon: 'sun' as const,
  },
  {
    id: 'nove-julho',
    street: 'Av. Nove de Julho',
    category: 'weather',
    label: 'Alagamento',
    reports: 9,
    time: 'Durante chuvas',
    cameras: 2,
    suggestion: 'Vistoria de drenagem',
    status: 'Encaminhado',
    icon: 'cloud-rain' as const,
  },
] as const;
export type MunicipalCategory = 'all' | 'security' | 'maintenance' | 'weather';
export const municipalCategories: { key: MunicipalCategory; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'security', label: 'Segurança' },
  { key: 'maintenance', label: 'Zeladoria' },
  { key: 'weather', label: 'Clima' },
];
export const maintenanceQueue = [
  {
    title: 'Calçada quebrada',
    address: 'R. Frei Caneca, 300–600',
    protocol: '#104822',
    reports: 17,
    status: 'Em execução',
    pointId: 'frei-caneca',
  },
  {
    title: 'Rua sem luz',
    address: 'R. Peixoto Gomide',
    protocol: '#104871',
    reports: 12,
    status: 'Aberto',
    pointId: 'peixoto',
  },
  {
    title: 'Rua sem luz',
    address: 'R. Augusta, 1100',
    protocol: '#104903',
    reports: 9,
    status: 'Encaminhado',
    pointId: 'augusta-1200',
  },
  {
    title: 'Obra na calçada',
    address: 'R. da Consolação, 1400',
    protocol: '#104915',
    reports: 7,
    status: 'Aberto',
    pointId: 'consolacao',
  },
  {
    title: 'Calçada quebrada',
    address: 'Al. Santos, 200',
    protocol: '#104760',
    reports: 5,
    status: 'Resolvido',
    pointId: 'frei-caneca',
  },
  {
    title: 'Alagamento',
    address: 'Av. Nove de Julho',
    protocol: '#104931',
    reports: 4,
    status: 'Encaminhado',
    pointId: 'nove-julho',
  },
] as const;
export const illustrativeCases = [
  {
    id: 'demo-sos',
    label: 'SOS · SEM RESPOSTA',
    address: 'R. Caio Prado, 230',
    summary: 'Detecção automática · contatos avisados no roteiro fictício',
    age: 'há 2 min',
    person: 'Leo',
    description: 'Parada longa fora da rota',
    time: '22:40',
  },
  {
    id: 'demo-confirmacao',
    label: 'SOS · EM CONFIRMAÇÃO',
    address: 'R. da Consolação, 1500',
    summary: 'Contato respondeu que está tudo bem · exemplo',
    age: 'há 6 min',
    person: 'Pessoa fictícia',
    description: 'Confirmação de segurança pendente',
    time: '22:36',
  },
  {
    id: 'demo-assedio',
    label: 'RELATO · ASSÉDIO',
    address: 'R. Augusta, 900',
    summary: '3 relatos no mesmo trecho em 1 h · exemplo',
    age: 'há 9 min',
    person: 'Relato anônimo fictício',
    description: 'Concentração de relatos de assédio',
    time: '22:33',
  },
] as const;
export const caseOutcomes = [
  'Usuário localizado e bem',
  'Encaminhado ao atendimento',
  'Ocorrência registrada',
  'Falso alarme',
] as const;
export const caseOutcomeDescriptions = [
  'Sem ferimentos, não precisou de atendimento',
  'SAMU ou pronto-socorro · exemplo',
  'Boletim de ocorrência · exemplo',
  'O alerta disparou sem risco real',
] as const;
export const pointStateSchema = z.object({
  gcm: z.boolean(),
  sp156: z.boolean(),
  note: z.string().max(280),
});
export type MunicipalityPointState = z.infer<typeof pointStateSchema>;
export const emptyPointState: MunicipalityPointState = { gcm: false, sp156: false, note: '' };
export const caseStatusLabels = {
  new: 'Novo alerta',
  assigned: 'Em atendimento simulado',
  closed: 'Encerrada na demonstração',
} as const;
export function formatMunicipalityDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}
