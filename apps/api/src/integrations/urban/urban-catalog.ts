import type { UrbanLayerType, UrbanSource } from '@safewalk/contracts';

export interface UrbanDefinition {
  id: string;
  type: UrbanLayerType;
  name: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  message: string;
  ttlSeconds: number;
  georeferencedCurrentEvents?: boolean;
  wfsName?: string;
  idField?: string;
}
const geo = {
  sourceUrl: 'https://novogeosampa.prefeitura.sp.gov.br/',
  attribution: 'Prefeitura de São Paulo / GeoSampa; órgãos produtores indicados nos atributos.',
  license:
    'CC BY-SA para camadas produzidas pelos órgãos municipais; consultar metadados de cada camada.',
};
export const urbanDefinitions: readonly UrbanDefinition[] = [
  {
    ...geo,
    id: 'geosampa-sidewalks',
    type: 'sidewalks',
    name: 'GeoSampa · cadastro de calçadas',
    wfsName: 'calcada',
    idField: 'cd_identificador_calcada',
    ttlSeconds: 604800,
    message:
      'Geometria, largura e declividade cadastrais. Sem data de vistoria disponível; não informa conservação, piso tátil ou passagem livre hoje.',
  },
  {
    ...geo,
    id: 'geosampa-lighting',
    type: 'lighting',
    name: 'GeoSampa · iluminação pública',
    wfsName: 'iluminacao_publica',
    idField: 'cd_identificador_iluminacao_publica',
    ttlSeconds: 86400,
    message:
      'Pontos cadastrados; presença de luminária não confirma funcionamento ou iluminação atual.',
  },
  {
    ...geo,
    id: 'geosampa-crossings',
    type: 'crossings',
    name: 'GeoSampa · semáforos CET',
    wfsName: 'semaforo',
    idField: 'cd_identificador',
    ttlSeconds: 604800,
    message:
      'Semáforos cadastrados. Não confirma travessia acessível, sinal sonoro, tempo semafórico ou funcionamento.',
  },
  {
    id: 'osm-signals',
    type: 'crossings',
    name: 'OpenStreetMap · semáforos das cidades vizinhas',
    sourceUrl: 'https://www.openstreetmap.org/copyright',
    attribution: '© colaboradores do OpenStreetMap.',
    license: 'Open Database License (ODbL) 1.0.',
    ttlSeconds: 7776000,
    message:
      'Cadastro colaborativo e incompleto de Taboão da Serra, Osasco, Guarulhos, ABC e vizinhas. Não confirma funcionamento, travessia acessível nem tempo semafórico; importação local necessária.',
  },
  {
    ...geo,
    id: 'geosampa-flood-history',
    type: 'flood_history',
    name: 'GeoSampa · ocorrências históricas de alagamento',
    wfsName: 'risco_ocorrencia_alagamento',
    idField: 'cd_identificador',
    ttlSeconds: 86400,
    message: 'Ocorrências históricas do SIGRC; não são alertas de alagamento em andamento.',
  },
  {
    ...geo,
    id: 'geosampa-flood-risk',
    type: 'flood_risk',
    name: 'GeoSampa · mancha modelada de inundação (TR 5 anos)',
    wfsName: 'mancha_inundacao_5',
    idField: 'cd_identificador',
    ttlSeconds: 604800,
    message:
      'Modelo hidrológico com período de retorno de 5 anos. Não representa água observada hoje nem previsão imediata.',
  },
  {
    id: 'sgb-flood-susceptibility',
    type: 'flood_susceptibility',
    name: 'SGB · suscetibilidade a inundações',
    sourceUrl:
      'https://geoportal.sgb.gov.br/server/rest/services/gestaoterritorial/inundacao/MapServer/0',
    attribution:
      'Serviço Geológico do Brasil (SGB/CPRM); executor e ano indicados em cada registro.',
    license: 'Consulta pública; verificar condições de reutilização específicas junto ao SGB.',
    ttlSeconds: 604800,
    message:
      'Carta de suscetibilidade modelada. Não informa alagamento em andamento nem condição atual da via. Cobertura e ano variam por município.',
  },
  {
    ...geo,
    id: 'geosampa-accessibility',
    type: 'accessibility',
    name: 'GeoSampa · selos de acessibilidade SMPED',
    wfsName: 'acessibilidade_smped',
    idField: 'cd_identificador_acessibilidade_smped',
    ttlSeconds: 604800,
    message:
      'Estabelecimentos com selo e ano cadastrado. Não certifica o caminho até o local nem parceria ou acolhimento SafeWalk.',
  },
  {
    ...geo,
    id: 'geosampa-health',
    type: 'health',
    name: 'GeoSampa · equipamentos de saúde',
    wfsName: 'equipamento_saude_hospital',
    idField: 'cd_identificador',
    ttlSeconds: 86400,
    message:
      'Cadastro de equipamentos de saúde, inclusive especializados. Horários, emergência e acolhimento precisam de verificação; não são parceiros SafeWalk.',
  },
  {
    ...geo,
    id: 'geosampa-police',
    type: 'police',
    name: 'GeoSampa · delegacias da Polícia Civil',
    wfsName: 'equipamento_policia_civil',
    idField: 'cd_identificador',
    ttlSeconds: 604800,
    message:
      'Delegacias cadastradas, inclusive Delegacias de Defesa da Mulher. Horário, plantão e atendimento não verificados; em emergência ligue 190.',
  },
  {
    id: 'osm-police',
    type: 'police',
    name: 'OpenStreetMap · polícia nas cidades vizinhas',
    sourceUrl: 'https://www.openstreetmap.org/copyright',
    attribution: '© colaboradores do OpenStreetMap.',
    license: 'Open Database License (ODbL) 1.0.',
    ttlSeconds: 7776000,
    message:
      'Delegacias e bases policiais mapeadas por voluntários (amenity=police). Cadastro colaborativo e incompleto; horário e atendimento não verificados. Em emergência ligue 190.',
  },
  {
    id: 'osm-hospitals',
    type: 'health',
    name: 'OpenStreetMap · hospitais nas cidades vizinhas',
    sourceUrl: 'https://www.openstreetmap.org/copyright',
    attribution: '© colaboradores do OpenStreetMap.',
    license: 'Open Database License (ODbL) 1.0.',
    ttlSeconds: 7776000,
    message:
      'Hospitais mapeados por voluntários (amenity=hospital). Cadastro colaborativo e incompleto; pronto-socorro, horário e atendimento não verificados.',
  },
  {
    id: 'sp156',
    type: 'sp156',
    name: 'SP156 · solicitações públicas importadas',
    sourceUrl: 'https://dados.prefeitura.sp.gov.br/dataset/dados-do-sp156',
    attribution: 'Prefeitura de São Paulo / SP156 / Portal de Dados Abertos.',
    license: 'Creative Commons CCZero, conforme catálogo CKAN.',
    ttlSeconds: 7776000,
    message:
      'Solicitações históricas por trimestre. Finalizada refere-se ao protocolo, sem comprovar reparo. Apenas registros com coordenadas originais são mapeados; importação local necessária.',
  },
  {
    id: 'infosiga',
    type: 'pedestrian_crashes',
    name: 'InfoSiga · registros históricos envolvendo pedestres',
    sourceUrl: 'https://infosiga.detran.sp.gov.br/',
    attribution: 'Detran-SP / Governo do Estado de São Paulo · InfoSiga.',
    license: 'CC BY 4.0, conforme catálogo de dados do Estado de São Paulo.',
    ttlSeconds: 7776000,
    message:
      'Registros históricos e notificações envolvendo pedestres. Notificação não confirma sinistro; precisão das coordenadas não informada. Não representa risco atual nem identifica vítimas.',
  },
  {
    id: 'cge-floods',
    type: 'floods',
    name: 'CGE · resumo municipal de alagamentos',
    sourceUrl: 'https://www.cgesp.org/v3/alagamentos.jsp',
    attribution: 'Centro de Gerenciamento de Emergências Climáticas / Prefeitura de São Paulo.',
    license:
      'Consulta pública com atribuição; licença de redistribuição específica não declarada na página.',
    ttlSeconds: 120,
    georeferencedCurrentEvents: false,
    message:
      'Resumo municipal de registros do CGE, sem coordenadas verificadas. Transitável/intransitável refere-se a veículos e não atesta segurança para pedestres.',
  },
  {
    id: 'open-meteo',
    type: 'weather',
    name: 'Open-Meteo · precipitação modelada',
    sourceUrl: 'https://open-meteo.com/en/docs',
    attribution: 'Weather data by Open-Meteo.com.',
    license:
      'Dados CC BY 4.0; endpoint gratuito destinado a uso não comercial e sujeito aos limites do provedor.',
    ttlSeconds: 600,
    message:
      'Estimativa meteorológica em célula de modelo. Chuva não confirma alagamento nem condição de uma calçada.',
  },
];

/** SGB receives an approximate map area only after explicit layer selection. */
export function selectUrbanDefinitions(types?: readonly UrbanLayerType[]): UrbanDefinition[] {
  return urbanDefinitions.filter((definition) =>
    types
      ? types.includes(definition.type)
      : !['sgb-flood-susceptibility', 'infosiga'].includes(definition.id),
  );
}

export function emptySource(definition: UrbanDefinition): UrbanSource {
  return {
    id: definition.id,
    name: definition.name,
    type: definition.type,
    sourceUrl: definition.sourceUrl,
    attribution: definition.attribution,
    license: definition.license,
    status:
      definition.id === 'sp156' ||
      definition.id === 'sgb-flood-susceptibility' ||
      definition.id === 'infosiga' ||
      definition.id.startsWith('osm-')
        ? 'not_configured'
        : 'unavailable',
    confidence: 'not_assessed',
    fetchedAt: null,
    asOf: null,
    expiresAt: null,
    featureCount: 0,
    georeferencedCurrentEvents: definition.georeferencedCurrentEvents ?? false,
    coverage: `${definition.id.startsWith('geosampa-') ? 'GeoSampa reúne dados municipais de São Paulo e não garante cobertura dos municípios vizinhos, inclusive Taboão da Serra. ' : ''}Nenhuma consulta válida armazenada para esta área.`,
    message: definition.message,
  };
}
