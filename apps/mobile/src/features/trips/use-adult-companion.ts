import { useState } from 'react';
import { useProfileSettings } from '@/features/auth/use-profile-settings';

/**
 * Child profile: a trip only starts after declaring that a responsible adult goes along.
 * The answer is asked again for each trip; the server refuses the start without it.
 */
export function useAdultCompanion() {
  const settings = useProfileSettings();
  const required = settings.data?.walkingProfile === 'child';
  const [confirmed, setConfirmed] = useState(false);
  return {
    required,
    confirmed,
    toggle: () => setConfirmed((value) => !value),
    /** Start button stays disabled until the adult confirms. */
    blocked: required && !confirmed,
    /** Extra fields for the trip start request. */
    startInput: required ? { adultAccompanying: confirmed } : {},
  };
}
