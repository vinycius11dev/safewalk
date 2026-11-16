import type { StyleProp, TextStyle } from 'react-native';
import { View } from 'react-native';
import type { CameraImageRequest } from '@safewalk/contracts';
import { AppText, Icon } from '@/components/ui/primitives';
import { cameraSimulationSteps } from './camera-request';
import { cameraRequestStepsStyles as s } from './camera-request-steps.styles';

/** Simulated progress of the Smart Sampa image request; every step is labeled as a test. */
export function CameraRequestSteps({
  request,
  now,
  doneColor,
  pendingColor,
  titleStyle,
  detailStyle,
}: {
  request: CameraImageRequest;
  now: number;
  doneColor: string;
  pendingColor: string;
  titleStyle?: StyleProp<TextStyle>;
  detailStyle?: StyleProp<TextStyle>;
}) {
  const steps = cameraSimulationSteps(request, now);
  return (
    <View style={s.list} accessibilityLiveRegion="polite">
      {steps.map((step) => (
        <View
          key={step.key}
          style={[s.step, !step.done && s.pending]}
          accessibilityLabel={`${step.title}. ${step.done ? step.detail : 'Aguardando esta etapa.'}`}
        >
          <Icon
            name={step.done ? 'check-circle' : 'clock'}
            size={16}
            color={step.done ? doneColor : pendingColor}
          />
          <View style={s.body}>
            <AppText variant="label" style={titleStyle}>
              {step.title}
            </AppText>
            <AppText variant="small" tone="muted" style={detailStyle}>
              {step.done ? step.detail : 'Aguardando esta etapa da simulação…'}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}
