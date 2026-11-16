import * as SecureStore from 'expo-secure-store';
import type { ThemeMode } from './tokens';

const KEY = 'safewalk.theme-mode';

export async function readStoredThemeMode(): Promise<ThemeMode | null> {
  try {
    const value = await SecureStore.getItemAsync(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}
export async function writeStoredThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, mode);
  } catch {
    // Preferência visual: falha de armazenamento não deve interromper o app.
  }
}
