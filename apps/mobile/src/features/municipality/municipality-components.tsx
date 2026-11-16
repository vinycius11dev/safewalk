import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AppText, Button, ErrorNotice } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createChartBarStyles, createMunicipalityStyles } from './municipality.styles';

export function MunicipalityMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  return (
    <View style={s.metric}>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
      <AppText style={s.metricNumber}>{value}</AppText>
      {detail && (
        <AppText variant="small" tone="muted">
          {detail}
        </AppText>
      )}
    </View>
  );
}
export function MunicipalityFilter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { key: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  return (
    <View style={s.filters}>
      <AppText variant="label">{label}</AppText>
      {options.map((option) => (
        <Pressable
          key={option.key}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${option.label}`}
          accessibilityState={{ selected: option.key === value }}
          onPress={() => onChange(option.key)}
          style={[s.chip, option.key === value && s.chipActive]}
        >
          <AppText variant="small" tone={option.key === value ? 'primary' : 'muted'}>
            {option.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
export function MunicipalityLoading({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  if (loading)
    return <ActivityIndicator accessibilityLabel="Carregando registros" color={colors.primary} />;
  if (error)
    return (
      <View>
        <ErrorNotice error={error} />
        <Button label="Tentar novamente" variant="secondary" onPress={onRetry} />
      </View>
    );
  return children;
}
export function MunicipalityChart({
  values,
  color,
}: {
  values: readonly { label: string; value: number }[];
  color?: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  const max = Math.max(1, ...values.map((point) => point.value));
  return (
    <View style={s.chart}>
      {values.map((point) => (
        <View key={point.label} style={s.barGroup}>
          <AppText variant="small">{point.value}</AppText>
          <View
            style={createChartBarStyles((point.value / max) * 115, color ?? colors.primary).bar}
          />
          <AppText style={s.chartLabel}>{point.label}</AppText>
        </View>
      ))}
    </View>
  );
}
