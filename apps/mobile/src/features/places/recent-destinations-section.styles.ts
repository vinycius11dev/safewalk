import { StyleSheet } from 'react-native';
import type { Colors } from '@/theme/tokens';

export const createRecentDestinationStyles = (c: Colors) =>
  StyleSheet.create({
    bubble: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.selected,
    },
  });
