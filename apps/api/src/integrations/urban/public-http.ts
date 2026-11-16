const allowedHosts = new Set([
  'wfs.geosampa.prefeitura.sp.gov.br',
  'www.cgesp.org',
  'dados.prefeitura.sp.gov.br',
  'api.open-meteo.com',
  'geoportal.sgb.gov.br',
]);
const pending = new Map<string, Promise<string>>();
const hostQueues = new Map<string, Promise<void>>();

export function validatePublicUrl(url: URL): void {
  if (
    url.protocol !== 'https:' ||
    !allowedHosts.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error('URBAN_URL_NOT_ALLOWED');
  }
}

async function readBounded(response: Response, maxBytes: number): Promise<string> {
  if (Number(response.headers.get('content-length')) > maxBytes)
    throw new Error('URBAN_RESPONSE_TOO_LARGE');
  if (!response.body) throw new Error('URBAN_EMPTY_RESPONSE');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('URBAN_RESPONSE_TOO_LARGE');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Only server-created URLs; one request at a time per host and identical requests coalesced. */
export function publicText(url: URL, maxBytes = 4_000_000): Promise<string> {
  validatePublicUrl(url);
  const key = url.href;
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 40) return Promise.reject(new Error('URBAN_PROVIDER_BUSY'));
  const previous = hostQueues.get(url.hostname) ?? Promise.resolve();
  const operation = previous
    .catch(() => undefined)
    .then(async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8_000),
          redirect: 'error',
          headers: {
            Accept: 'application/json, text/html;q=0.8',
            'User-Agent': 'SafeWalk/0.1 (public urban context; cached)',
          },
        });
        if ((response.status === 429 || response.status >= 500) && attempt === 0) {
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, 400));
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error(`URBAN_HTTP_${response.status}`);
        }
        return readBounded(response, maxBytes);
      }
      throw new Error('URBAN_PROVIDER_UNAVAILABLE');
    });
  const tail = operation.then(
    () => undefined,
    () => undefined,
  );
  hostQueues.set(url.hostname, tail);
  pending.set(key, operation);
  void operation
    .finally(() => {
      pending.delete(key);
      if (hostQueues.get(url.hostname) === tail) hostQueues.delete(url.hostname);
    })
    .catch(() => undefined);
  return operation;
}

export async function publicJson(url: URL): Promise<unknown> {
  return JSON.parse(await publicText(url)) as unknown;
}
