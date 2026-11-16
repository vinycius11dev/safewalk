import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Coordinates, ReportInput } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { reportsService, type ReportPhotoAsset } from './reports.service';
export function useReports() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['reports', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) => reportsService.list(session?.token ?? '', signal),
  });
}
export function useCreateReport() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportInput) => reportsService.create(session?.token ?? '', input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['reports'] }),
  });
}
export function useReport(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['report', session?.user.id, id],
    enabled: Boolean(session && id),
    queryFn: ({ signal }) => reportsService.get(session?.token ?? '', id, signal),
  });
}
export function useResolveReport() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsService.resolve(session?.token ?? '', id),
    onSuccess: (report) => {
      client.setQueryData(['report', session?.user.id, report.id], report);
      return client.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useNearbyCommunityReports(location: Coordinates | null, radiusMeters = 1200) {
  const { session } = useAuth();
  // A new GPS point arrives every few seconds. Query by a roughly 100 m cell instead of
  // sending a new request for every fix while the traveler walks.
  const queryCenter = location
    ? {
        latitude: Math.round(location.latitude * 1000) / 1000,
        longitude: Math.round(location.longitude * 1000) / 1000,
      }
    : null;
  return useQuery({
    queryKey: ['community-reports', session?.user.id, queryCenter, radiusMeters],
    enabled: Boolean(session && queryCenter),
    queryFn: ({ signal }) =>
      reportsService.nearby(session?.token ?? '', queryCenter!, radiusMeters, signal),
    staleTime: 30_000,
    refetchInterval: location ? 60_000 : false,
  });
}

export function useCommunityReportFeedback() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, choice }: { id: string; choice: 'present' | 'resolved' | 'not_found' }) =>
      reportsService.feedback(session?.token ?? '', id, choice),
    onSuccess: () => client.invalidateQueries({ queryKey: ['community-reports'] }),
  });
}

export function useFlagCommunityReport() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsService.flag(session?.token ?? '', id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['community-reports'] }),
  });
}

export function useUploadReportPhoto() {
  const { session } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, asset }: { id: string; asset: ReportPhotoAsset }) =>
      reportsService.uploadPhoto(session?.token ?? '', id, asset),
    onSuccess: (report) => {
      client.setQueryData(['report', session?.user.id, report.id], report);
      client.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
