import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errors.js';

function serviceOrigin(value: string, fallback: string): string {
  const url = new URL(value || fallback);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    throw new Error('Configure apenas a origem do serviço geográfico, sem credenciais ou caminho.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.protocol !== 'https:' &&
    !(local && env.NODE_ENV !== 'production' && url.protocol === 'http:')
  )
    throw new Error('O serviço geográfico deve usar HTTPS.');
  return url.origin;
}
export const photonOrigin = serviceOrigin(env.PHOTON_BASE_URL, 'https://photon.komoot.io');
export const valhallaOrigin = serviceOrigin(
  env.VALHALLA_BASE_URL,
  'https://valhalla1.openstreetmap.de',
);
export const communityServices = {
  photon: photonOrigin === 'https://photon.komoot.io',
  valhalla: valhallaOrigin === 'https://valhalla1.openstreetmap.de',
};
export function requireGeographicProvider(provider: keyof typeof communityServices): void {
  if (env.GEOGRAPHIC_SERVICES_ENABLED === 'false')
    throw new AppError(
      503,
      'GEOGRAPHIC_SERVICES_DISABLED',
      'Os serviços de mapas estão desativados nesta instalação.',
    );
  if (
    env.NODE_ENV === 'production' &&
    communityServices[provider] &&
    env.ALLOW_COMMUNITY_GEO_SERVICES !== 'true'
  )
    throw new AppError(
      503,
      'GEOGRAPHIC_PROVIDER_NOT_CONFIGURED',
      'Configure um provedor geográfico com capacidade adequada para produção.',
    );
}
export const attribution = '© OpenStreetMap contributors · https://www.openstreetmap.org/copyright';
