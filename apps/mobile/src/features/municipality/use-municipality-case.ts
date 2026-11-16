import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { municipalityService } from './municipality.service';
import type { MunicipalityCaseState } from './municipality.model';

export function useMunicipalityCase(caseId = 'demo-sos') {
  const { session } = useAuth();
  const client = useQueryClient();
  const ownerId = session?.user.id ?? '';
  const queryKey = ['municipality-case', ownerId, caseId];
  const query = useQuery({
    queryKey,
    enabled: Boolean(ownerId),
    queryFn: () => municipalityService.getCase(ownerId, caseId),
  });
  const update = useMutation({
    mutationFn: (state: MunicipalityCaseState) =>
      municipalityService.saveCase(ownerId, caseId, state),
    onSuccess: (state) => client.setQueryData(queryKey, state),
  });
  return { query, update };
}
