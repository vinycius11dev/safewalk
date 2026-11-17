import { QUEUE_REFRESH_MS } from '../../api/queries';
import { formatSince } from '../../shared/format';
import { useNow } from '../../shared/use-now';

type Props = {
  /** Instante da última busca que deu certo (0 enquanto nenhuma chegou). */
  updatedAt: number;
  /** A última tentativa de atualizar falhou. */
  failing: boolean;
};

/** "Ao vivo" só enquanto a fila está mesmo sendo atualizada; o tempo é o da última resposta. */
export function LiveIndicator({ updatedAt, failing }: Props) {
  const now = useNow(1_000);
  if (updatedAt <= 0) return null;
  const elapsed = now - updatedAt;
  const stale = failing || elapsed > QUEUE_REFRESH_MS * 3;
  return (
    <p
      className="live"
      data-state={stale ? 'stale' : 'live'}
      title={`A fila se atualiza sozinha a cada ${QUEUE_REFRESH_MS / 1000} segundos`}
    >
      <span className="live-now">
        <span className="live-dot" aria-hidden="true" />
        <strong>{stale ? 'Sem atualizar' : 'Ao vivo'}</strong>
      </span>
      <span className="num">
        {stale ? `última resposta ${formatSince(elapsed)}` : `atualizado ${formatSince(elapsed)}`}
      </span>
    </p>
  );
}
