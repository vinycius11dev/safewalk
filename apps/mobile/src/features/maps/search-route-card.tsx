import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { favoriteColors } from '@/theme/tokens';
import { createSearchRouteCardStyles } from './search-route-card.styles';

/** The side of the trip that is not being typed: tap to change it. */
export type RouteEndpoint = {
  label: string;
  hint?: string;
  /** Nothing chosen yet: dashed outline and a call to action. */
  empty?: boolean;
  /** The person's current GPS position: shows the "você está aqui" badge. */
  here?: boolean;
  actionLabel: string;
  onPress: () => void;
};

type Props = {
  /** Which side is typed in the search field; `single` (saving a favorite) has no trip rows. */
  active: 'from' | 'to' | 'single';
  from?: RouteEndpoint;
  to?: RouteEndpoint;
  inputLabel: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  autoFocus: boolean;
  gps: { title: string; hint: string; loading: boolean; onPress: () => void };
  /** Shown above the rows, e.g. when origin and destination are the same place. */
  notice?: string | null;
};

/** "De / Para" card of navigation apps: where you leave from, where you go, and your location. */
export function SearchRouteCard({
  active,
  from,
  to,
  inputLabel,
  placeholder,
  value,
  onChangeText,
  autoFocus,
  gps,
  notice,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createSearchRouteCardStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const overline = active === 'from' ? 'De onde você sai' : active === 'to' ? 'Para onde' : null;

  const search = (
    <View style={[s.searchBar, focused && s.searchBarFocused]}>
      <Icon name="search" size={20} color={focused ? colors.primaryText : colors.muted} />
      <View style={s.searchBody}>
        {overline && <Text style={s.overline}>{overline}</Text>}
        <TextInput
          nativeID="safewalk-search-input"
          accessibilityLabel={inputLabel}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={s.input}
        />
      </View>
      {value.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          style={s.clear}
          onPress={() => onChangeText('')}
        >
          <Icon name="x" size={20} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );

  const endpoint = (side: 'from' | 'to', item: RouteEndpoint) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${side === 'from' ? 'Saindo de' : 'Indo para'}: ${item.label}${item.hint ? `, ${item.hint}` : ''}. ${item.actionLabel}`}
      style={({ pressed }) => [
        s.endpoint,
        item.empty && s.endpointEmpty,
        pressed && s.endpointPressed,
      ]}
      onPress={item.onPress}
    >
      <View style={s.endpointBody}>
        <Text style={s.overline}>{side === 'from' ? 'Saindo de' : 'Indo para'}</Text>
        <Text style={[s.endpointText, item.empty && s.endpointTextEmpty]} numberOfLines={1}>
          {item.label}
        </Text>
        {item.here && (
          <View style={s.hereBadge}>
            <Icon name="navigation" size={10} color={colors.white} />
            <Text style={s.hereBadgeText}>Você está aqui</Text>
          </View>
        )}
        {item.hint ? (
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {item.hint}
          </AppText>
        ) : null}
      </View>
      <View style={s.change}>
        <AppText tone="primary" variant="label">
          {item.empty ? 'Escolher' : 'Alterar'}
        </AppText>
      </View>
    </Pressable>
  );

  return (
    <View style={s.card}>
      {notice ? (
        <View style={s.notice} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Icon name="map-pin" size={18} color={colors.warning} />
          <Text style={s.noticeText}>{notice}</Text>
        </View>
      ) : null}
      {active === 'single' ? (
        search
      ) : (
        <View style={s.trip}>
          <View style={s.rail} importantForAccessibility="no-hide-descendants">
            <View style={s.originDot} />
            <View style={s.connector} />
            <View style={s.destinationPin}>
              <Icon name="map-pin" size={18} color={favoriteColors.destination} />
            </View>
          </View>
          <View style={s.fields}>
            {active === 'from' ? search : from && endpoint('from', from)}
            {active === 'to' ? search : to && endpoint('to', to)}
          </View>
        </View>
      )}
      <View style={s.divider} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${gps.title}. ${gps.hint}`}
        accessibilityState={{ busy: gps.loading }}
        disabled={gps.loading}
        style={({ pressed }) => [s.gpsRow, pressed && s.gpsRowPressed]}
        onPress={gps.onPress}
      >
        <View style={s.gpsIcon}>
          {gps.loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Icon name="navigation" size={18} color={colors.white} />
          )}
        </View>
        <View style={s.gpsBody}>
          <Text style={s.gpsTitle}>{gps.title}</Text>
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {gps.hint}
          </AppText>
        </View>
      </Pressable>
    </View>
  );
}
