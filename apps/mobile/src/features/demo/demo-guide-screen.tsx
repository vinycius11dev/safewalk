import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Protected, Screen } from '@/components/layout/screen';
import { AppText, Badge, Button, ErrorNotice, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import {
  demoRealFeatures,
  demoSimulatedFeatures,
  demoStepIndex,
  demoSteps,
  type DemoAction,
} from './demo-guide-steps';
import { createDemoGuideStyles, walkedTrack } from './demo-guide.styles';
import { DemoScene } from './demo-scene';
import { useDemoWalk } from './use-demo-walk';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createDemoGuideStyles(colors), [colors]);
}

/** A apresentação é uma caminhada: a linha vai da origem até o pino de destino. */
function WalkProgress({ index }: { index: number }) {
  const { colors } = useTheme();
  const s = useStyles();
  const last = demoSteps.length - 1;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Progresso da apresentação"
      accessibilityValue={{ min: 1, max: demoSteps.length, now: index + 1 }}
      style={s.progress}
    >
      <View style={s.track}>
        <View style={[s.trackWalked, walkedTrack(index, demoSteps.length)]} />
      </View>
      <View style={s.stops}>
        {demoSteps.map((step, stop) => (
          <View key={step.id} style={s.stop}>
            {stop === last ? (
              <Icon
                name="map-pin"
                size={18}
                color={index === last ? colors.success : colors.muted}
              />
            ) : stop === index ? (
              <View style={s.walker} />
            ) : (
              <View style={[s.dot, stop < index && s.dotWalked]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function WalkAction({ hint }: { hint: string }) {
  const s = useStyles();
  const walk = useDemoWalk();
  return (
    <View style={s.action}>
      <ErrorNotice error={walk.error} />
      {walk.loadFailed ? (
        <Button label="Tentar de novo" variant="secondary" icon="refresh-cw" onPress={walk.retry} />
      ) : walk.activeId || walk.canStart ? (
        <Button
          label={walk.activeId ? 'Abrir caminhada de teste' : 'Começar caminhada de teste'}
          icon="play"
          loading={walk.loading}
          onPress={walk.open}
        />
      ) : (
        <AppText tone="muted">A caminhada de teste existe só na conta de demonstração.</AppText>
      )}
      <AppText variant="small" tone="muted">
        {hint}
      </AppText>
    </View>
  );
}

function StepAction({ action }: { action: DemoAction }) {
  if (action.kind === 'walk') return <WalkAction hint={action.hint} />;
  return (
    <Button label={action.label} variant="secondary" onPress={() => router.push(action.href)} />
  );
}

function FeatureList({
  title,
  items,
  icon,
  color,
}: {
  title: string;
  items: string[];
  icon: 'check-circle' | 'alert-circle';
  color: string;
}) {
  const s = useStyles();
  return (
    <View style={s.list}>
      <AppText variant="subtitle">{title}</AppText>
      {items.map((item) => (
        <View key={item} style={s.listItem}>
          <Icon name={icon} size={18} color={color} />
          <AppText style={s.listText}>{item}</AppText>
        </View>
      ))}
    </View>
  );
}

function DemoSummary() {
  const { colors } = useTheme();
  return (
    <>
      <FeatureList
        title="Funciona de verdade"
        items={demoRealFeatures}
        icon="check-circle"
        color={colors.success}
      />
      <FeatureList
        title="Simulado por enquanto"
        items={demoSimulatedFeatures}
        icon="alert-circle"
        color={colors.warning}
      />
      <Button
        label="Ver todas as telas"
        variant="secondary"
        icon="grid"
        onPress={() => router.push('/telas-demo')}
      />
    </>
  );
}

export function DemoGuideScreen() {
  const s = useStyles();
  const { passo } = useLocalSearchParams<{ passo?: string }>();
  const index = demoStepIndex(passo);
  const step = demoSteps[index];
  if (!step) return null;
  const isFirst = index === 0;
  const isLast = index === demoSteps.length - 1;
  const goTo = (target: number) => router.setParams({ passo: demoSteps[target]?.id });
  const leaveToApp = () => router.replace('/inicio');
  return (
    <Protected>
      <Screen
        title="Conheça o SafeWalk"
        scroll={false}
        right={
          <AppText variant="small" tone="muted">
            {index + 1} de {demoSteps.length}
          </AppText>
        }
      >
        <WalkProgress index={index} />
        <ScrollView key={step.id} contentContainerStyle={s.content}>
          {step.kind === 'story' ? <DemoScene scene={step.scene} /> : null}
          <View style={s.copy}>
            <AppText variant="title" accessibilityRole="header">
              {step.title}
            </AppText>
            <AppText tone="muted">{step.body}</AppText>
          </View>
          {step.kind === 'story' && step.availability ? (
            <View style={s.availability}>
              <Badge label={step.availability.label} tone={step.availability.tone} />
              <AppText variant="small" tone="muted">
                {step.availability.note}
              </AppText>
            </View>
          ) : null}
          {step.kind === 'story' && step.action ? <StepAction action={step.action} /> : null}
          {step.kind === 'summary' ? <DemoSummary /> : null}
        </ScrollView>
        <View style={s.footer}>
          <Button
            label={isFirst ? 'Pular' : 'Voltar'}
            variant="secondary"
            containerStyle={s.footerButton}
            onPress={() => (isFirst ? leaveToApp() : goTo(index - 1))}
          />
          <Button
            label={isFirst ? 'Começar' : isLast ? 'Usar o app' : 'Próximo'}
            containerStyle={s.footerButton}
            onPress={() => (isLast ? leaveToApp() : goTo(index + 1))}
          />
        </View>
      </Screen>
    </Protected>
  );
}
