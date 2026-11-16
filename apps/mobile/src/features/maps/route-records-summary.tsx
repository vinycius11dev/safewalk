import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import type { RealRoute } from '@safewalk/contracts';
import { AppText, Badge } from '@/components/ui/primitives';
import { durationLabel, durationSpoken } from '@/lib/duration';
import { useTheme } from '@/theme/theme-provider';
import {
  recordsCompareLabel,
  recordsLevelLabel,
  recordsLevelTone,
  recordsPeriodText,
  recordsReason,
} from './route-records-presentation';
import { createRouteRecordsStyles } from './route-records-summary.styles';

export function RouteRecordsSummary({
  options,
  selected,
  onSelect,
}: {
  options: RealRoute[];
  selected: RealRoute;
  onSelect: (route: RealRoute) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createRouteRecordsStyles(colors), [colors]);
  const reading = selected.recordsReading;
  if (!reading) return null;
  const comparable = options.slice(0, 2);
  return (
    <View style={s.container}>
      {options.length > 1 && (
        <View style={s.compare} accessibilityRole="radiogroup">
          {comparable.map((route) => (
            <Pressable
              key={route.id}
              style={[s.option, route.id === selected.id && s.optionSelected]}
              accessibilityRole="radio"
              accessibilityState={{ checked: route.id === selected.id }}
              accessibilityLabel={`${durationSpoken(route.durationMinutes)}. ${recordsCompareLabel(route)}`}
              onPress={() => onSelect(route)}
            >
              <AppText variant="subtitle">{durationLabel(route.durationMinutes)}</AppText>
              <AppText variant="small" tone="muted" numberOfLines={2}>
                {recordsCompareLabel(route)}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
      <View style={s.reading}>
        <View style={s.headerRow}>
          <Badge label={recordsLevelLabel(reading)} tone={recordsLevelTone(reading)} />
          <AppText variant="small" tone="muted">
            {recordsPeriodText(reading)}
          </AppText>
        </View>
        <AppText variant="small">{recordsReason(reading)}</AppText>
        <AppText variant="small" tone="muted">
          Mostra o que já foi registrado. Não indica que um caminho seja seguro.
        </AppText>
      </View>
    </View>
  );
}
