import type { Colors, ThemeMode } from './tokens';

/** Expõe os tokens do tema ao global.css como variáveis CSS. */
export function syncThemeDocument(mode: ThemeMode, colors: Colors, authColors: Colors): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  root.style.setProperty('--sw-outer', colors.outer);
  root.style.setProperty('--sw-border', colors.border);
  root.style.setProperty('--sw-focus', colors.primaryText);
  root.style.setProperty('--sw-scroll', colors.border);
  root.style.setProperty('--sw-auth-bg', authColors.background);
  root.style.setProperty('--sw-auth-scroll', authColors.border);
}
