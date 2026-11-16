import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import type { FloodRouteAssessment, UrbanFeature, UrbanLayersResponse } from '@safewalk/contracts';
import type { MapRecordGroup } from '@/components/map/real-map.types';
import { recordIconImages } from '@/components/map/record-icons';
import { AppText, Badge, Button, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { routeCategories, featureRouteCategory } from './route-layer-presentation';
import { floodAssessmentBadge, shouldShowFloodAssessmentInline } from './route-flood-presentation';
import type { useRouteLayerPresentation } from './use-route-layer-presentation';
import { RouteConditions } from './route-conditions';
import { createRouteLayerPanelStyles } from './route-layer-panel.styles';

type ViewModel = ReturnType<typeof useRouteLayerPresentation>;
export function RouteLayerPanel({
  view,
  data,
  assessment,
  now,
  refreshing,
  error,
  onRefresh,
  onSelect,
  group,
  onCloseGroup,
}: {
  view: ViewModel;
  data?: UrbanLayersResponse;
  assessment?: FloodRouteAssessment;
  now: number;
  refreshing: boolean;
  error: unknown;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  group: MapRecordGroup | null;
  onCloseGroup: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createRouteLayerPanelStyles(colors), [colors]);
  const [open, setOpen] = useState<'layers' | 'records' | 'conditions' | null>(null);
  const [search, setSearch] = useState('');
  const modeLabel =
    view.selection.mode === 'auto'
      ? 'Automático'
      : view.selection.mode === 'all'
        ? 'Todos'
        : 'Personalizado';
  const ids = group ? new Set(group.ids) : null;
  const records = view.features
    .filter(
      (feature) =>
        (!ids || ids.has(feature.id)) &&
        `${feature.properties.title} ${routeCategories.find((c) => c.id === featureRouteCategory(feature))?.label ?? ''} ${feature.properties.details.status ?? ''}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('pt-BR')
          .includes(
            search
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLocaleLowerCase('pt-BR'),
          ),
    )
    .sort(
      (a, b) =>
        featureRouteCategory(a).localeCompare(featureRouteCategory(b)) ||
        a.properties.title.localeCompare(b.properties.title, 'pt-BR'),
    );
  const select = (feature: UrbanFeature) => {
    setOpen(null);
    setSearch('');
    onCloseGroup();
    onSelect(feature.id);
  };
  const close = () => {
    setOpen(null);
    setSearch('');
    onCloseGroup();
  };
  const listRow = (feature: UrbanFeature) => {
    const category = routeCategories.find((c) => c.id === featureRouteCategory(feature))!;
    return (
      <Pressable
        style={s.record}
        accessibilityRole="button"
        accessibilityLabel={`Ver ${feature.properties.title}`}
        onPress={() => select(feature)}
      >
        <View style={s.pictogram}>
          <Image style={s.image} source={recordIconImages[category.icon]} />
        </View>
        <View style={s.text}>
          <AppText variant="label">{feature.properties.title}</AppText>
          <AppText style={s.caption}>
            {category.label}
            {typeof feature.properties.details.status === 'string'
              ? ` · ${feature.properties.details.status}`
              : ''}
          </AppText>
        </View>
        <Icon name="chevron-right" size={16} />
      </Pressable>
    );
  };
  return (
    <>
      <View style={s.compact}>
        <View style={s.row}>
          <Pressable
            style={[s.action, s.grow]}
            accessibilityRole="button"
            accessibilityLabel="Camadas do percurso"
            onPress={() => setOpen('layers')}
          >
            <Icon name="layers" size={17} />
            <AppText variant="label">Camadas</AppText>
            <AppText style={s.caption}>{modeLabel}</AppText>
          </Pressable>
          <Pressable
            style={s.action}
            accessibilityRole="button"
            accessibilityLabel={`Ver todos os ${view.features.length} registros`}
            onPress={() => {
              setSearch('');
              setOpen('records');
            }}
          >
            <Icon name="list" size={17} />
            <AppText variant="label">{view.features.length}</AppText>
          </Pressable>
        </View>
        <View style={s.row}>
          {refreshing && <ActivityIndicator size="small" color={colors.primary} />}
          <AppText style={[s.caption, s.grow]}>
            {data
              ? `${view.records.features.length} de ${view.features.length} no mapa · cobertura parcial`
              : refreshing
                ? 'Carregando registros do percurso…'
                : 'Dados do percurso indisponíveis nesta consulta'}
          </AppText>
        </View>
        {data && (
          <AppText style={s.caption}>
            {view.counts.signals} semáforos cadastrados · {view.counts.reports} solicitações abertas
            {view.raining ? ' · Chuva recente no modelo' : ''}
          </AppText>
        )}
        {assessment && shouldShowFloodAssessmentInline(assessment) && (
          <View style={s.compact}>
            <Badge
              label={floodAssessmentBadge(assessment).label}
              tone={floodAssessmentBadge(assessment).tone}
            />
            <AppText style={s.caption} numberOfLines={2}>
              {assessment.summary}
            </AppText>
          </View>
        )}
        <ErrorNotice error={error} />
      </View>
      {(open || group) && (
        <Modal visible transparent animationType="slide" onRequestClose={close}>
          <View style={s.overlay}>
            <View style={s.sheet} accessibilityViewIsModal>
              <View style={s.header}>
                <View style={s.grow}>
                  <AppText variant="heading">
                    {group
                      ? `${group.ids.length} registros próximos`
                      : open === 'layers'
                        ? 'Camadas do percurso'
                        : open === 'conditions'
                          ? 'Condições e fontes'
                          : 'Todos os registros'}
                  </AppText>
                  <AppText style={s.caption}>
                    {group
                      ? 'A quantidade identifica registros agrupados.'
                      : 'Informações completas, com o mapa organizado.'}
                  </AppText>
                </View>
                <Pressable
                  style={s.close}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar camadas e registros"
                  onPress={close}
                >
                  <Icon name="x" />
                </Pressable>
              </View>
              {open === 'layers' && !group ? (
                <>
                  <View style={s.modes}>
                    {(
                      [
                        { value: 'auto', label: 'Automático' },
                        { value: 'custom', label: 'Personalizado' },
                        { value: 'all', label: 'Todos' },
                      ] as const
                    ).map((mode) => (
                      <Pressable
                        key={mode.value}
                        style={[s.mode, view.selection.mode === mode.value && s.chosen]}
                        accessibilityRole="radio"
                        aria-checked={view.selection.mode === mode.value}
                        accessibilityState={{ checked: view.selection.mode === mode.value }}
                        onPress={() => view.setMode(mode.value)}
                      >
                        <AppText variant="small">{mode.label}</AppText>
                      </Pressable>
                    ))}
                  </View>
                  <AppText style={s.caption}>
                    Automático prioriza semáforos e solicitações abertas. Perfil, horário e chuva
                    acrescentam camadas relevantes.
                  </AppText>
                  <ScrollView style={s.list} contentContainerStyle={s.content}>
                    {routeCategories.map((category) => (
                      <Pressable
                        key={category.id}
                        style={s.record}
                        accessibilityRole="checkbox"
                        aria-checked={view.enabled.includes(category.id)}
                        accessibilityState={{ checked: view.enabled.includes(category.id) }}
                        accessibilityLabel={`${category.label}, ${view.counts[category.id]} registros`}
                        onPress={() => view.toggle(category.id)}
                      >
                        <View style={s.pictogram}>
                          <Image style={s.image} source={recordIconImages[category.icon]} />
                        </View>
                        <View style={s.text}>
                          <AppText variant="label">{category.label}</AppText>
                          {category.id === 'signals' && view.counts.signals === 0 && (
                            <AppText style={s.caption}>
                              {!data && refreshing
                                ? 'Consultando cadastros…'
                                : 'Sem dados de semáforos para este trecho.'}
                            </AppText>
                          )}
                        </View>
                        <AppText style={s.count}>{view.counts[category.id]}</AppText>
                        <Icon
                          name={view.enabled.includes(category.id) ? 'check-square' : 'square'}
                          color={
                            view.enabled.includes(category.id) ? colors.primaryText : colors.muted
                          }
                          size={20}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Button
                    label="Restaurar automático"
                    variant="ghost"
                    onPress={() => view.setMode('auto')}
                  />
                  <Button
                    label={`Ver todos os registros (${view.features.length})`}
                    variant="secondary"
                    onPress={() => {
                      setSearch('');
                      setOpen('records');
                    }}
                  />
                  <Button
                    label="Condições, clima e fontes"
                    variant="ghost"
                    onPress={() => setOpen('conditions')}
                  />
                </>
              ) : open === 'conditions' && !group ? (
                <ScrollView style={s.list}>
                  <RouteConditions
                    data={data}
                    assessment={assessment}
                    accessible={view.accessible}
                    now={now}
                    refreshing={refreshing}
                    error={error}
                    onRefresh={onRefresh}
                  />
                </ScrollView>
              ) : (
                <>
                  <Field
                    label="Buscar nos registros"
                    placeholder="Tipo, assunto ou situação"
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                  />
                  <FlatList
                    style={s.list}
                    data={records}
                    keyExtractor={(item) => item.id}
                    initialNumToRender={10}
                    renderItem={({ item }) => listRow(item)}
                    ListEmptyComponent={
                      <AppText tone="muted">
                        {refreshing
                          ? 'Carregando registros do percurso…'
                          : 'Nenhum registro corresponde a esta consulta.'}
                      </AppText>
                    }
                  />
                  {group && (
                    <Button
                      label="Aproximar este grupo"
                      icon="zoom-in"
                      onPress={() => {
                        group.expand();
                        close();
                      }}
                    />
                  )}
                  {!group && (
                    <Badge label="Histórico e situação desconhecida permanecem disponíveis aqui" />
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
