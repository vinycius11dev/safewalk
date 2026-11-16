import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { municipalityService } from './municipality.service';
import type { MunicipalityPointState } from './municipality.model';
export function useMunicipalityPoint(pointId: string) {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? '';
  const client = useQueryClient();
  const queryKey = ['municipality-point', ownerId, pointId];
  const query = useQuery({
    queryKey,
    enabled: Boolean(ownerId),
    queryFn: () => municipalityService.getPoint(ownerId, pointId),
  });
  const update = useMutation({
    mutationFn: (state: MunicipalityPointState) =>
      municipalityService.savePoint(ownerId, pointId, state),
    onSuccess: (state) => client.setQueryData(queryKey, state),
  });
  return { query, update };
}
