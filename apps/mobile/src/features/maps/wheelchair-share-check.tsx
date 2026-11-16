import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createWheelchairShareCheckStyles } from './wheelchair-share-check.styles';

/** Sensitive information: contacts only learn about the wheelchair when this is checked. */
export function WheelchairShareCheck({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createWheelchairShareCheckStyles(colors), [colors]);
  return (
    <Pressable
      style={[s.check, checked && s.checkOn]}
      accessibilityRole="checkbox"
      accessibilityLabel="Avisar meus contatos que este trajeto tem uma cadeira de rodas"
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={onToggle}
    >
      <Icon
        name={checked ? 'check-square' : 'square'}
        size={20}
        color={checked ? colors.primaryText : colors.muted}
      />
      <View style={s.body}>
        <AppText variant="label">Avisar meus contatos</AppText>
        <AppText variant="small" tone="muted">
          O link deste trajeto dirá que há uma cadeira de rodas.
        </AppText>
      </View>
    </Pressable>
  );
}
