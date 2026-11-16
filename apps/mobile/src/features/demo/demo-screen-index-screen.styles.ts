import { StyleSheet } from 'react-native';
import { spacing } from '@/theme/tokens';

export const demoScreenIndexStyles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  link: { flexBasis: '47%', flexGrow: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  linkText: { fontSize: 13, lineHeight: 18, textAlign: 'center', flexShrink: 1 },
});
