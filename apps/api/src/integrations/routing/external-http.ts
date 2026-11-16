import { AppError } from '../../middleware/errors.js';
import { photonOrigin, valhallaOrigin } from './providers.js';

const origins = new Set([photonOrigin, valhallaOrigin]);
const queues = new Map<string, Promise<void>>();
const pending = new Map<string, number>();
const lastRequest = new Map<string, number>();
const unavailableUntil = new Map<string, number>();
const maximumBytes = 1_500_000;

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Empty geographic response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new Error('Geographic response too large');
      }
      body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body) as unknown;
  } finally {
    reader.releaseLock();
  }
}

/** Only server-configured provider origins are allowed; redirects never expand that scope. */
export async function geographicJson(url: URL): Promise<unknown> {
  if (!origins.has(url.origin)) throw new Error('Geographic origin is not allowed');
  const host = url.origin;
  if ((unavailableUntil.get(host) ?? 0) > Date.now())
    throw new AppError(
      503,
      'GEOGRAPHIC_PROVIDER_COOLDOWN',
      'O provedor está temporariamente indisponível. Aguarde um momento.',
    );
  if ((pending.get(host) ?? 0) >= 6)
    throw new AppError(
      429,
      'GEOGRAPHIC_PROVIDER_BUSY',
      'Há consultas de mapas em andamento. Aguarde para tentar novamente.',
    );
  pending.set(host, (pending.get(host) ?? 0) + 1);
  const previous = queues.get(host) ?? Promise.resolve();
  let release: () => void = () => {};
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  queues.set(host, turn);
  await previous;
  try {
    const delay = Math.max(0, (lastRequest.get(host) ?? 0) + 1100 - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if ((unavailableUntil.get(host) ?? 0) > Date.now())
      throw new AppError(
        503,
        'GEOGRAPHIC_PROVIDER_COOLDOWN',
        'O provedor está temporariamente indisponível. Aguarde um momento.',
      );
    lastRequest.set(host, Date.now());
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SafeWalk/0.1 (local pedestrian-map prototype)',
        Accept: 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const retrySeconds = Number(response.headers.get('retry-after'));
      unavailableUntil.set(
        host,
        Date.now() +
          (response.status === 429
            ? Math.max(
                30000,
                Math.min(300000, Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 60000),
              )
            : 30000),
      );
      throw new AppError(
        503,
        'GEOGRAPHIC_PROVIDER_UNAVAILABLE',
        'O provedor de mapas não respondeu à consulta. Tente novamente mais tarde.',
      );
    }
    const data = await boundedJson(response);
    unavailableUntil.delete(host);
    return data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    unavailableUntil.set(host, Date.now() + 30000);
    throw new AppError(
      503,
      'GEOGRAPHIC_PROVIDER_UNAVAILABLE',
      'Não foi possível consultar o provedor de mapas. Nenhum trajeto foi inventado.',
    );
  } finally {
    pending.set(host, Math.max(0, (pending.get(host) ?? 1) - 1));
    release();
    if (queues.get(host) === turn) queues.delete(host);
  }
}
