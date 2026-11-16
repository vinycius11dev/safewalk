import type { ThemeMode } from './tokens';

const KEY = 'safewalk.theme-mode';

export async function readStoredThemeMode(): Promise<ThemeMode | null> {
  try {
    const value = globalThis.localStorage?.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}
export async function writeStoredThemeMode(mode: ThemeMode): Promise<void> {
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    // Preferência visual: falha de armazenamento não deve interromper o app.
  }
}
