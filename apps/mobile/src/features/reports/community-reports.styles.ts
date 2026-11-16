import { StyleSheet } from 'react-native';
import type { Colors } from '@/theme/tokens';

export const createCommunityReportStyles = (c: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#07111dcc',
      justifyContent: 'center',
      padding: 18,
    },
    quickCard: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 14 },
    headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    grow: { flex: 1, gap: 4 },
    info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    controlRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    choiceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    choice: {
      flexGrow: 1,
      minWidth: 86,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: 10,
      paddingVertical: 9,
      alignItems: 'center',
    },
    choiceSelected: { borderColor: c.primary, backgroundColor: c.selected },
    photoPreview: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 14,
      backgroundColor: c.surface,
    },
    reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    reportText: { flex: 1, gap: 4 },
    distance: { textAlign: 'right' },
    summary: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    photoAction: { alignSelf: 'flex-start', paddingVertical: 6 },
    photoError: { color: c.danger },
    reportList: { gap: 12 },
    nearbyPrompt: {
      gap: 10,
      borderWidth: 1,
      borderColor: c.warning,
      backgroundColor: c.raised,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  });
