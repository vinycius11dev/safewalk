import { StyleSheet } from 'react-native';

export const cameraRequestStepsStyles = StyleSheet.create({
  list: { gap: 12 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  body: { flex: 1, gap: 2 },
  pending: { opacity: 0.6 },
});
