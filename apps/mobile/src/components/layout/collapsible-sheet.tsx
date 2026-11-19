import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ComponentRef,
  type ReactNode,
  type Ref,
} from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
} from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/theme/theme-provider';
import {
  createCollapsibleSheetStyles,
  createSheetMotionStyles,
  sheetFrameStyles,
} from './collapsible-sheet.styles';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';
/** Mola quase criticamente amortecida: assenta rápido, sem passar da posição final. */
const SPRING = { stiffness: 260, damping: 30, mass: 1, overshootClamping: true } as const;
const DRAG_START_PX = 6;
/** Velocidade (px/ms) a partir da qual um gesto rápido decide o sentido sozinho. */
const FLING_VELOCITY = 0.35;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const heightOf = (event: LayoutChangeEvent) => Math.round(event.nativeEvent.layout.height);

/** Gesto vertical: o painel segue o dedo e, ao soltar, assenta no estado mais próximo. */
function createSheetDrag({
  progress,
  travel,
  collapsed,
  settle,
}: {
  progress: Animated.Value;
  travel: number;
  collapsed: boolean;
  settle: (expand: boolean, velocityPxPerMs?: number) => void;
}) {
  // Progresso no início do arrasto (1 = aberto, 0 = minimizado).
  let dragStart = collapsed ? 0 : 1;
  const positionAfter = (dy: number) => clamp(dragStart - dy / travel);
  return PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      travel > 0 &&
      Math.abs(gesture.dy) > DRAG_START_PX &&
      Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      dragStart = collapsed ? 0 : 1;
      progress.stopAnimation((value) => {
        dragStart = value;
      });
    },
    onPanResponderMove: (_event, gesture) => progress.setValue(positionAfter(gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      const expand =
        gesture.vy < -FLING_VELOCITY
          ? true
          : gesture.vy > FLING_VELOCITY
            ? false
            : positionAfter(gesture.dy) > 0.5;
      settle(expand, gesture.vy);
    },
    onPanResponderTerminate: () => settle(!collapsed),
  });
}

export type CollapsibleSheetHandle = { reveal: () => void };

/**
 * Painel inferior que minimiza deslizando para baixo.
 *
 * Minimizado, continuam à vista a alça e uma destas partes:
 * - `summary`: resumo curto que substitui o conteúdo (troca com esmaecimento);
 * - `header`: começo do conteúdo, que permanece visível nos dois estados.
 * `footer` fica fixo embaixo e sempre visível (ex.: SOS). `children` só aparece aberto.
 * Toque na alça alterna; também é possível arrastar a alça ou o resumo.
 */
export function CollapsibleSheet({
  summary,
  header,
  footer,
  children,
  initiallyCollapsed = false,
  maxHeight = '72%',
  expandLabel = 'Mostrar detalhes',
  collapseLabel = 'Minimizar',
  onCoverChange,
  ref,
}: {
  /** `reveal()` abre o painel (se minimizado) e volta ao topo do conteúdo. */
  ref?: Ref<CollapsibleSheetHandle>;
  /** Altura, em pontos, que o painel cobre na base da tela no estado atual (aberto ou minimizado). */
  onCoverChange?: (heightPoints: number) => void;
  summary?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  initiallyCollapsed?: boolean;
  maxHeight?: DimensionValue;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createCollapsibleSheetStyles(colors), [colors]);
  const reduceMotion = useReduceMotion();
  // Guardado em estado (via callback ref) para ser usado pelos gestos sem ler refs no render.
  const [scrollView, setScrollView] = useState<ComponentRef<typeof ScrollView> | null>(null);
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [handleHeight, setHandleHeight] = useState(0);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [headerBottom, setHeaderBottom] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(initiallyCollapsed ? 0 : 1));

  const peekContent = summary !== undefined ? summaryHeight : headerBottom;
  const travel = Math.max(0, sheetHeight - handleHeight - peekContent - footerHeight);
  // Esconde o painel até as medidas existirem, evitando um quadro na posição errada.
  const measured =
    sheetHeight > 0 &&
    handleHeight > 0 &&
    (summary === undefined || summaryHeight > 0) &&
    (header === undefined || headerBottom > 0) &&
    (footer === undefined || footerHeight > 0);
  const motion = useMemo(() => createSheetMotionStyles(progress, travel), [progress, travel]);
  const frame = useMemo(() => sheetFrameStyles(maxHeight, footerHeight), [maxHeight, footerHeight]);
  const cover = measured ? sheetHeight - (collapsed ? travel : 0) : 0;
  useEffect(() => {
    if (cover > 0) onCoverChange?.(cover);
  }, [cover, onCoverChange]);

  const settle = useCallback(
    (expand: boolean, velocityPxPerMs = 0) => {
      setCollapsed(!expand);
      // Minimizado mostra o começo do conteúdo, então volta ao topo.
      if (!expand) scrollView?.scrollTo({ y: 0, animated: !reduceMotion });
      const toValue = expand ? 1 : 0;
      if (reduceMotion || travel === 0) {
        progress.setValue(toValue);
        return;
      }
      Animated.spring(progress, {
        ...SPRING,
        toValue,
        // O gesto mede px/ms para baixo; a mola espera progresso por segundo.
        velocity: (-velocityPxPerMs * 1000) / travel,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    },
    [progress, reduceMotion, scrollView, travel],
  );

  const pan = useMemo(
    () => createSheetDrag({ progress, travel, collapsed, settle }),
    [collapsed, progress, settle, travel],
  );

  useImperativeHandle(
    ref,
    () => ({
      reveal: () => {
        if (collapsed) settle(true);
        scrollView?.scrollTo({ y: 0, animated: !reduceMotion });
      },
    }),
    [collapsed, reduceMotion, scrollView, settle],
  );

  return (
    <View style={s.clip}>
      <Animated.View
        onLayout={(event) => setSheetHeight(heightOf(event))}
        style={[s.sheet, frame.sheet, motion.sheet, !measured && s.unmeasured]}
      >
        {/* O gesto fica no contêiner: o botão assume o toque, e o arrasto o transfere ao painel. */}
        <View onLayout={(event) => setHandleHeight(heightOf(event))} {...pan.panHandlers}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={collapsed ? expandLabel : collapseLabel}
            accessibilityState={{ expanded: !collapsed }}
            style={s.handle}
            onPress={() => settle(collapsed)}
          >
            <View style={s.handleBar} />
            <View style={s.handleLabel}>
              <Animated.View style={motion.chevron}>
                <Icon name="chevron-down" size={16} />
              </Animated.View>
              <AppText variant="small" tone="muted">
                {collapsed ? expandLabel : collapseLabel}
              </AppText>
            </View>
          </Pressable>
        </View>
        <View style={s.body}>
          <ScrollView ref={setScrollView} style={s.scroll} scrollEnabled={!collapsed}>
            {header !== undefined && (
              <View
                onLayout={(event) => {
                  const { y, height } = event.nativeEvent.layout;
                  setHeaderBottom(Math.round(y + height));
                }}
              >
                {header}
              </View>
            )}
            <Animated.View
              style={[collapsed ? s.inert : s.interactive, motion.details]}
              aria-hidden={collapsed}
              accessibilityElementsHidden={collapsed}
              importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
            >
              {children}
            </Animated.View>
          </ScrollView>
          {summary !== undefined && (
            <Animated.View
              onLayout={(event) => setSummaryHeight(heightOf(event))}
              style={[s.summary, collapsed ? s.passThrough : s.inert, motion.summary]}
              aria-hidden={!collapsed}
              accessibilityElementsHidden={!collapsed}
              importantForAccessibility={collapsed ? 'auto' : 'no-hide-descendants'}
              {...pan.panHandlers}
            >
              {summary}
            </Animated.View>
          )}
        </View>
        {footer !== undefined && <View style={frame.footerSpace} />}
      </Animated.View>
      {footer !== undefined && (
        <View style={s.footer} onLayout={(event) => setFooterHeight(heightOf(event))}>
          {footer}
        </View>
      )}
    </View>
  );
}
