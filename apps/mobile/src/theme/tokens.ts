export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 };
export const radii = { sm: 10, md: 14, lg: 22, pill: 99 };
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};
/** Cores fixas da marca: o ladrilho e o símbolo são iguais nos dois temas. */
export const brandColors = {
  night: '#0E1726',
  cream: '#F5F3EC',
  amber: '#F2B45A',
  amberOnLight: '#E39A2C',
} as const;
export const darkColors = {
  background: '#111C2D',
  surface: '#19263A',
  raised: '#243550',
  border: '#354862',
  text: '#F2F1E9',
  muted: '#B0BDCE',
  primary: '#2F6FEB',
  primaryText: '#7AAAFF',
  success: '#54D7B0',
  warning: '#F4BD58',
  danger: '#FF6B6B',
  dangerButton: '#E32636',
  selected: '#264A59',
  outer: '#0C1625',
  mapRoad: '#2A3B56',
  mapAvenue: '#405675',
  mapPark: '#183B30',
  white: '#FFFFFF',
};
export type Colors = { [K in keyof typeof darkColors]: string };
/**
 * Bolhas dos registros no mapa: o símbolo é branco, então os fundos são saturados e iguais
 * nos dois temas (contraste ≥ 4,5:1 com branco). Semáforo usa fundo escuro, como o equipamento.
 */
export const mapMarkerColors = {
  signals: '#1F2937',
  reports: '#C42F3B',
  floods: '#0369A1',
  floodsRaining: '#B45309',
  sidewalks: '#C2410C',
  lighting: '#8A5A00',
  accessibility: '#2F5FD0',
  police: '#1E3A8A',
  health: '#15803D',
  history: '#526077',
  unknown: '#526077',
  /** Solicitações do SP156 por tipo de serviço (buraco, árvore, bueiro, calçada, obstáculo). */
  potholes: '#EA580C',
  trees: '#4D7C0F',
  drains: '#7C3AED',
  brokenSidewalk: '#BE185D',
  obstacles: '#0D9488',
  outline: '#FFFFFF',
} as const;
/** Círculos dos favoritos (símbolo branco, contraste ≥ 4,5:1 nos dois temas). */
export const favoriteColors = {
  home: '#2F6FEB',
  work: '#7C3AED',
  other: '#B45309',
  map: '#0F766E',
  gps: '#2F6FEB',
  /** Destination pin of the "De / Para" card. */
  destination: '#E5484D',
} as const;
export type ThemeMode = 'dark' | 'light';
export const lightColors: Colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  raised: '#EAF0FA',
  border: '#D9E2EF',
  text: '#15233A',
  muted: '#5A6A82',
  primary: '#2F6FEB',
  primaryText: '#235CCC',
  success: '#007A5C',
  warning: '#8F5A00',
  danger: '#C42F3B',
  dangerButton: '#D92636',
  selected: '#E8F0FF',
  outer: '#E7EDF6',
  mapRoad: '#DDE5F0',
  mapAvenue: '#C4D1E5',
  mapPark: '#D8EFE1',
  white: '#FFFFFF',
};
