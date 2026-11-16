import { brandColors, type Colors, type ThemeMode } from '@/theme/tokens';

export const safeWalkMarkHeightRatio = 723 / 743;

/** `theme` acompanha o fundo da tela; `tile` é para o ladrilho escuro da marca. */
export type SafeWalkMarkTone = 'theme' | 'tile';

export const resolveSafeWalkMarkColors = (
  tone: SafeWalkMarkTone,
  colors: Colors,
  mode: ThemeMode,
) => {
  if (tone === 'tile') return { line: brandColors.cream, dot: brandColors.amber };
  return {
    line: colors.text,
    dot: mode === 'dark' ? brandColors.amber : brandColors.amberOnLight,
  };
};
