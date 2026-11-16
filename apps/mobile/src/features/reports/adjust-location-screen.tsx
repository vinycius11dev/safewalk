import { router } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { LocationPicker } from '@/components/map/location-picker';
import { ErrorNotice } from '@/components/ui/primitives';
import { useMapConsent, useSetMapConsent } from '@/features/maps/use-map-data';
import { useReportDraft } from './use-report-draft';

export function AdjustLocationScreen() {
  const { draft, update } = useReportDraft();
  const consent = useMapConsent();
  const setConsent = useSetMapConsent();
  return (
    <Protected>
      <Screen title="Onde aconteceu?" scroll={false}>
        <ErrorNotice error={consent.error ?? setConsent.error} />
        <LocationPicker
          initialAddress={draft.address}
          initialLocation={draft.location}
          mapEnabled={Boolean(consent.data?.enabled)}
          onRequestMap={() => setConsent.mutate(true)}
          mapRequestPending={setConsent.isPending}
          onConfirm={(selection) => {
            update(selection);
            router.replace('/relatar');
          }}
        />
      </Screen>
    </Protected>
  );
}
