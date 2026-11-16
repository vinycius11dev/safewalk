import type { MapRainStatus } from './real-map.types';

export function rainStatusLabel(status: MapRainStatus): string {
  switch (status) {
    case 'raining':
      return 'Chuva estimada';
    case 'dry':
      return 'Sem chuva indicada';
    case 'stale':
      return 'Chuva desatualizada';
    case 'unknown':
      return 'Chuva indisponível';
  }
}

export function rainStatusDescription(status: MapRainStatus): string {
  switch (status) {
    case 'raining':
      return 'Chuva estimada na região do percurso, segundo o modelo meteorológico.';
    case 'dry':
      return 'O modelo meteorológico não indica chuva na região do percurso.';
    case 'stale':
      return 'Os dados meteorológicos de chuva estão desatualizados.';
    case 'unknown':
      return 'Não há dados meteorológicos recentes de chuva para a região do percurso.';
  }
}
