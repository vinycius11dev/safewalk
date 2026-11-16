import {
  parseRecentDestinations,
  withRecentDestination,
  type RecentDestination,
} from './recent-destinations';

/**
 * Na web o SQLite exige cabeçalhos COOP/COEP que bloqueariam os tiles e fontes de outros
 * domínios do mapa. Os destinos recentes ficam no localStorage, com as mesmas regras do SQLite.
 */
const prefix = 'safewalk.recent-destinations.v1.';

function read(ownerId: string): RecentDestination[] {
  try {
    const value = window.localStorage.getItem(prefix + ownerId);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parseRecentDestinations(parsed) : [];
  } catch {
    return [];
  }
}
function write(ownerId: string, list: readonly RecentDestination[]) {
  if (list.length) window.localStorage.setItem(prefix + ownerId, JSON.stringify(list));
  else window.localStorage.removeItem(prefix + ownerId);
}

export async function listRecentDestinations(ownerId: string): Promise<RecentDestination[]> {
  return read(ownerId);
}
export async function saveRecentDestination(ownerId: string, entry: RecentDestination) {
  write(ownerId, withRecentDestination(read(ownerId), entry));
}
export async function removeRecentDestination(ownerId: string, key: string) {
  write(
    ownerId,
    read(ownerId).filter((item) => item.key !== key),
  );
}
export async function clearRecentDestinations(ownerId?: string) {
  if (ownerId) return write(ownerId, []);
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => window.localStorage.removeItem(key));
}
