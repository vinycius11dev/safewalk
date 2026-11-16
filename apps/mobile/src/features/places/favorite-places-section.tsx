import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { SavedPlace, SavedPlaceKind } from '@safewalk/contracts';
import { ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import {
  FAVORITE_LIMIT,
  favoriteKindIcons,
  favoriteKindLabels,
  favoriteShortcuts,
} from './favorite-places';
import { createFavoritePlacesStyles, favoriteBubbleStyles } from './favorite-places-section.styles';

type Props = {
  places: readonly SavedPlace[] | undefined;
  loading: boolean;
  error: Error | null;
  /** Texto da ação, por exemplo "Ir para" ou "Sair de". */
  verb: string;
  onSelect: (place: SavedPlace) => void;
  /** Abre a busca que salva (ou troca) o endereço de um favorito. */
  onEdit: (kind: SavedPlaceKind, place?: SavedPlace) => void;
  onManage: () => void;
};

/** Casa, Trabalho e favoritos, com o atalho para adicionar novos, como no Waze. */
export function FavoritePlacesSection({
  places,
  loading,
  error,
  verb,
  onSelect,
  onEdit,
  onManage,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createFavoritePlacesStyles(colors), [colors]);
  const { home, work, others } = useMemo(() => favoriteShortcuts(places ?? []), [places]);
  const full = (places?.length ?? 0) >= FAVORITE_LIMIT;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.title} accessibilityRole="header">
          Favoritos
        </Text>
        {places && (
          <Text style={s.counter}>
            {places.length} de {FAVORITE_LIMIT}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Gerenciar favoritos"
          style={s.manage}
          onPress={onManage}
        >
          <Text style={s.tileAction}>Gerenciar</Text>
        </Pressable>
      </View>
      {loading && <ActivityIndicator color={colors.primary} />}
      <ErrorNotice error={error} />
      {places && (
        <>
          <View style={s.shortcuts}>
            {(
              [
                ['home', home],
                ['work', work],
              ] as const
            ).map(([kind, place]) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={
                  place
                    ? `${verb} ${favoriteKindLabels[kind]}, ${place.address}`
                    : `Adicionar endereço de ${favoriteKindLabels[kind]}`
                }
                accessibilityHint={place ? 'Toque e segure para trocar o endereço' : undefined}
                style={({ pressed }) => [s.tile, !place && s.tileEmpty, pressed && s.tilePressed]}
                onPress={() => (place ? onSelect(place) : onEdit(kind))}
                onLongPress={() => onEdit(kind, place ?? undefined)}
              >
                <View style={s.tileTop}>
                  <View style={favoriteBubbleStyles[kind]}>
                    <Icon name={favoriteKindIcons[kind]} size={19} color={colors.white} />
                  </View>
                  {!place && (
                    <View style={s.plusBadge}>
                      <Icon name="plus" size={15} color={colors.white} />
                    </View>
                  )}
                </View>
                <Text style={s.tileLabel}>{favoriteKindLabels[kind]}</Text>
                {place ? (
                  <Text style={s.tileAddress} numberOfLines={2}>
                    {place.address}
                  </Text>
                ) : (
                  <Text style={s.tileAction}>Toque para adicionar</Text>
                )}
              </Pressable>
            ))}
          </View>
          <View style={s.list}>
            {others.map((place) => (
              <View key={place.id}>
                <View style={s.rowWrap}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${verb} ${place.label}, ${place.address}`}
                    style={({ pressed }) => [s.row, s.rowMain, pressed && s.rowPressed]}
                    onPress={() => onSelect(place)}
                  >
                    <View style={favoriteBubbleStyles.other}>
                      <Icon name="star" size={18} color={colors.white} />
                    </View>
                    <View style={s.rowBody}>
                      <Text style={s.rowLabel} numberOfLines={1}>
                        {place.label}
                      </Text>
                      <Text style={s.tileAddress} numberOfLines={1}>
                        {place.address}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Trocar endereço de ${place.label}`}
                    style={s.rowAction}
                    onPress={() => onEdit('other', place)}
                  >
                    <Icon name="edit-2" size={18} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={s.rowDivider} />
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                full
                  ? `Limite de ${FAVORITE_LIMIT} favoritos atingido. Exclua um em Gerenciar.`
                  : 'Adicionar favorito'
              }
              accessibilityState={{ disabled: full }}
              disabled={full}
              style={({ pressed }) => [s.row, pressed && s.rowPressed, full && s.disabled]}
              onPress={() => onEdit('other')}
            >
              <View style={s.addIcon}>
                <Icon name="plus" size={20} color={colors.primaryText} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.addLabel}>Adicionar favorito</Text>
                <Text style={s.tileAddress} numberOfLines={2}>
                  {full
                    ? `Você já tem ${FAVORITE_LIMIT} locais. Exclua um em Gerenciar.`
                    : 'Academia, escola, casa de alguém que você visita…'}
                </Text>
              </View>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
