import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeMode } from './tokens';
import { syncThemeDocument } from './theme-document';
import { readStoredThemeMode, writeStoredThemeMode } from './theme-storage';

type ThemeValue = {
  mode: ThemeMode;
  colors: typeof darkColors;
  setMode: (mode: ThemeMode) => void;
};

/**
 * Com `fixedMode` o tema é fixo (ex.: telas de autenticação) e não lê nem grava preferência.
 * Sem ele, usa a escolha salva do usuário ou, na falta dela, o esquema do sistema.
 */
function useThemeValue(fixedMode?: ThemeMode): ThemeValue {
  const system = useColorScheme();
  const [stored, setStored] = useState<ThemeMode | null>(null);
  useEffect(() => {
    if (fixedMode) return;
    let active = true;
    void readStoredThemeMode().then((value) => {
      if (active && value) setStored(value);
    });
    return () => {
      active = false;
    };
  }, [fixedMode]);
  const mode: ThemeMode = fixedMode ?? stored ?? (system === 'light' ? 'light' : 'dark');
  const setMode = useCallback(
    (next: ThemeMode) => {
      if (fixedMode) return;
      setStored(next);
      void writeStoredThemeMode(next);
    },
    [fixedMode],
  );
  const colors = mode === 'dark' ? darkColors : lightColors;
  useEffect(() => {
    if (!fixedMode) syncThemeDocument(mode, colors, lightColors);
  }, [fixedMode, mode, colors]);
  return useMemo(() => ({ mode, colors, setMode }), [mode, colors, setMode]);
}
const ThemeContext = createContext<ThemeValue | null>(null);
export function ThemeProvider({
  children,
  initialMode,
}: PropsWithChildren<{ initialMode?: ThemeMode }>) {
  return <ThemeContext value={useThemeValue(initialMode)}>{children}</ThemeContext>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider ausente.');
  return context;
}
