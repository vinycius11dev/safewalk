import * as SecureStore from 'expo-secure-store';

const key = (ownerId: string, caseId: string) => `safewalk.municipality.${ownerId}.${caseId}`;
export async function readMunicipalityState(
  ownerId: string,
  caseId: string,
): Promise<string | null> {
  return SecureStore.getItemAsync(key(ownerId, caseId));
}
export async function writeMunicipalityState(
  ownerId: string,
  caseId: string,
  value: string,
): Promise<void> {
  await SecureStore.setItemAsync(key(ownerId, caseId), value);
}
