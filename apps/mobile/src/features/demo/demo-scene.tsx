import { useMemo } from 'react';
import { View } from 'react-native';
import { MapScene } from '@/components/map/map-scene';
import { AppText, Badge, Icon } from '@/components/ui/primitives';
import { SafeWalkMark } from '@/components/ui/safewalk-mark';
import { useTheme } from '@/theme/theme-provider';
import type { DemoScene as DemoSceneData } from './demo-guide-steps';
import { createDemoGuideStyles } from './demo-guide.styles';

function DemoEmblem({ emblem }: { emblem: NonNullable<DemoSceneData['emblem']> }) {
  const { colors } = useTheme();
  const s = useMemo(() => createDemoGuideStyles(colors), [colors]);
  if (emblem === 'pin') {
    return (
      <View style={s.pinRow}>
        {[0, 1, 2, 3].map((digit) => (
          <View key={digit} style={s.pinDot} />
        ))}
      </View>
    );
  }
  if (emblem === 'sos') {
    return (
      <View style={[s.emblem, s.emblemSos]}>
        <AppText style={s.emblemSosText}>SOS</AppText>
      </View>
    );
  }
  return (
    <View style={[s.emblem, s.emblemBrand]}>
      <SafeWalkMark size={48} tone="tile" />
    </View>
  );
}

/** Ilustração de um passo: mapa desenhado com o que a pessoa veria naquele momento. */
export function DemoScene({ scene }: { scene: DemoSceneData }) {
  const { colors } = useTheme();
  const s = useMemo(() => createDemoGuideStyles(colors), [colors]);
  const toneColor = { danger: colors.danger, success: colors.success };
  return (
    <View style={[s.scene, !scene.cards && s.sceneCentered]}>
      <MapScene variant={scene.map} adaptive={false} />
      <View style={s.sceneCaption}>
        <Badge label="Exemplo ilustrativo" />
      </View>
      {scene.emblem ? <DemoEmblem emblem={scene.emblem} /> : null}
      {scene.cards?.map((card) => (
        <View key={card.title} style={[s.sceneCard, card.tone === 'danger' && s.sceneCardDanger]}>
          <Icon name={card.icon} color={card.tone ? toneColor[card.tone] : colors.primaryText} />
          <View style={s.sceneCardBody}>
            <AppText variant="label">{card.title}</AppText>
            <AppText variant="small" tone="muted">
              {card.detail}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
