import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminReportListQuery, GovernmentStatus } from '@safewalk/contracts';
import { adminApi } from './admin-client';

/** A fila se atualiza sozinha: quem trabalha nela vê o que chegou sem recarregar. */
export const QUEUE_REFRESH_MS = 5_000;
/** Indicadores e detalhe mudam menos; também são refeitos quando a fila recebe um relato. */
const REFRESH_MS = 15_000;

export const useSummary = () =>
  useQuery({
    queryKey: ['summary'],
    queryFn: adminApi.summary,
    refetchInterval: REFRESH_MS,
  });

export const useReports = (query: AdminReportListQuery) =>
  useQuery({
    queryKey: ['reports', query],
    queryFn: () => adminApi.reports(query),
    refetchInterval: QUEUE_REFRESH_MS,
    placeholderData: keepPreviousData,
  });

export const useReportDetail = (id: string | null) =>
  useQuery({
    queryKey: ['report', id],
    queryFn: () => adminApi.report(id ?? ''),
    enabled: id !== null,
    refetchInterval: REFRESH_MS,
  });

/** Foto do relato como endereço temporário; é liberado ao trocar de relato ou sair da tela. */
export function useReportPhoto(id: string | null, hasPhoto: boolean) {
  const blob = useQuery({
    queryKey: ['photo', id],
    queryFn: () => adminApi.photo(id ?? ''),
    enabled: id !== null && hasPhoto,
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob.data) {
      setUrl(null);
      return;
    }
    const created = URL.createObjectURL(blob.data);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [blob.data]);
  return { url, isPending: blob.isPending && hasPhoto, isError: blob.isError };
}

export function useChangeStatus(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: GovernmentStatus; note: string }) =>
      adminApi.changeStatus(id, input.status, input.note),
    onSuccess: (detail) => {
      client.setQueryData(['report', id], detail);
      void client.invalidateQueries({ queryKey: ['reports'] });
      void client.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

/** Refaz os indicadores na hora, sem esperar o próximo ciclo (ex.: chegou um relato novo). */
export function useRefreshSummary(): () => void {
  const client = useQueryClient();
  return useCallback(() => void client.invalidateQueries({ queryKey: ['summary'] }), [client]);
}
