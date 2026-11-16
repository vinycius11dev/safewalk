import { StyleSheet } from 'react-native';
import { spacing, type Colors } from '@/theme/tokens';

export function createSettingsPinPromptStyles(c: Colors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: c.outer,
      padding: spacing.lg,
    },
    dialog: { width: '100%', maxWidth: 420, alignSelf: 'center' },
    header: { alignItems: 'center', gap: 8 },
    actions: { gap: 8 },
  });
}
