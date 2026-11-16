import { useQuery, useQueryClient } from '@tanstack/react-query';
import { canSendToGovernment, type ReportInput } from '@safewalk/contracts';
import { useAuth } from '@/features/auth/auth-provider';
import { FIAP_LOCATION } from '@/features/maps/maps.service';

const newDraft = (): ReportInput => ({
  type: 'robbery',
  description: '',
  address: '',
  shareWithCommunity: false,
  shareWithGovernment: false,
  // Camera reference only. Submission also requires an explicit map selection.
  location: FIAP_LOCATION,
});
type ReportDraftState = { report: ReportInput; locationConfirmed: boolean };
const newState = (): ReportDraftState => ({ report: newDraft(), locationConfirmed: false });
export function useReportDraft() {
  const { session } = useAuth();
  const client = useQueryClient();
  const queryKey = ['report-draft-v4', session?.user.id];
  const { data } = useQuery({
    queryKey,
    queryFn: async () => newState(),
    initialData: newState,
    enabled: false,
    gcTime: Infinity,
  });
  return {
    draft: data.report,
    locationConfirmed: data.locationConfirmed,
    update: (patch: Partial<ReportInput>) =>
      client.setQueryData<ReportDraftState>(queryKey, (previous) => {
        const current = previous ?? newState();
        // Crime não vai ao painel da Prefeitura: trocar para ele desliga o envio.
        const sendable = canSendToGovernment(patch.type ?? current.report.type);
        return {
          report: {
            ...current.report,
            ...patch,
            shareWithGovernment:
              sendable && (patch.shareWithGovernment ?? current.report.shareWithGovernment),
          },
          locationConfirmed:
            patch.location === undefined
              ? current.locationConfirmed
              : Boolean(patch.address && patch.address.trim().length >= 3),
        };
      }),
    reset: () => client.setQueryData(queryKey, newState()),
  };
}
