import type { CameraImageRequest } from '@safewalk/contracts';
import { localTime } from '@/lib/time';

export const CAMERA_REQUEST_TITLE = 'Câmeras Smart Sampa · pedido simulado';
export const CAMERA_SIMULATION_NOTE =
  'Simulação: nenhuma câmera real foi acionada e nenhuma imagem foi recebida.';

const placeByBasis: Record<CameraImageRequest['basis'], string> = {
  last_position: 'da última posição registrada',
  route: 'do trajeto planejado',
  none: 'sem posição registrada',
};

/** What the simulated request would ask the central: where and in which time window. */
export function cameraRequestText(request: CameraImageRequest): string {
  const window = `das ${localTime(request.windowStart)} às ${localTime(request.windowEnd)}`;
  if (request.basis === 'none')
    return `Pedido registrado ${window}, mas sem posição ou trajeto para localizar as câmeras.`;
  return `Imagens das câmeras num raio de ${request.radiusMeters} m ${placeByBasis[request.basis]}, ${window}.`;
}

/** Delays of the demonstration steps, counted from the moment the request was recorded. */
export const CAMERA_SIMULATED_RECEIPT_DELAY_MS = 20_000;
export const CAMERA_SIMULATED_ANSWER_DELAY_MS = 60_000;

export type CameraSimulationStep = {
  key: 'requested' | 'received' | 'answered';
  title: string;
  detail: string;
  done: boolean;
};

/**
 * Demonstration timeline of the request, the same for the traveler and the contacts because it
 * is derived only from the recorded instant. No step comes from a real central.
 */
export function cameraSimulationSteps(
  request: CameraImageRequest,
  nowMs: number,
): CameraSimulationStep[] {
  const elapsedMs = nowMs - Date.parse(request.requestedAt);
  const located = request.basis !== 'none';
  return [
    {
      key: 'requested',
      title: `Pedido montado às ${localTime(request.requestedAt)}`,
      detail: cameraRequestText(request),
      done: true,
    },
    {
      key: 'received',
      title: 'Central Smart Sampa recebeu · simulação',
      detail: 'Etapa de teste: nenhuma central real recebeu este pedido.',
      done: elapsedMs >= CAMERA_SIMULATED_RECEIPT_DELAY_MS,
    },
    {
      key: 'answered',
      title: located ? 'Busca nas câmeras concluída · simulação' : 'Sem local para buscar câmeras',
      detail: located
        ? 'Nenhuma imagem foi recebida. Numa integração real, a Prefeitura decide se as imagens são liberadas e para quem.'
        : 'Sem posição ou trajeto registrados, o pedido não teria onde procurar.',
      done: elapsedMs >= CAMERA_SIMULATED_ANSWER_DELAY_MS,
    },
  ];
}
