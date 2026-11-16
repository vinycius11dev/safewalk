import { Platform, StyleSheet } from 'react-native';
import type { Colors } from '@/theme/tokens';
export const createFrameStyles = (c: Colors) =>
  StyleSheet.create({
    stage: {
      flex: 1,
      backgroundColor: c.outer,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({ web: { minHeight: '100%', paddingVertical: 24 }, default: {} }),
    },
    authStage: {
      backgroundColor: c.white,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      paddingVertical: 0,
      ...Platform.select({ web: { minHeight: '100dvh', width: '100%' }, default: {} }),
    },
    frame: {
      width: '100%',
      backgroundColor: c.background,
      ...Platform.select({
        web: {
          flexGrow: 0,
          flexShrink: 0,
          width: 390,
          maxWidth: '100%',
          height: 844,
          overflow: 'hidden',
          borderRadius: 26,
          borderWidth: 1,
          borderColor: c.border,
        },
        default: { flex: 1 },
      }),
    },
    authFrame: {
      flex: 1,
      width: '100%',
      maxWidth: '100%',
      height: '100%',
      backgroundColor: c.white,
      borderRadius: 0,
      borderWidth: 0,
      ...Platform.select({
        web: { flexGrow: 1, flexShrink: 1, overflow: 'hidden' },
        default: {},
      }),
    },
    wide: { ...Platform.select({ web: { width: 1160, height: 860 }, default: {} }) },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      backgroundColor: c.background,
    },
  });
