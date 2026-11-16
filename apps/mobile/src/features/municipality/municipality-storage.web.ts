const key = (ownerId: string, caseId: string) => `safewalk.municipality.${ownerId}.${caseId}`;
export async function readMunicipalityState(
  ownerId: string,
  caseId: string,
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(key(ownerId, caseId));
}
export async function writeMunicipalityState(
  ownerId: string,
  caseId: string,
  value: string,
): Promise<void> {
  window.sessionStorage.setItem(key(ownerId, caseId), value);
}
