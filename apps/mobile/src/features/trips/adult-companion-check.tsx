import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createAdultCompanionCheckStyles } from './adult-companion-check.styles';

type Props = { required: boolean; confirmed: boolean; onToggle: () => void };

/** Child profile: the adult going along confirms before the trip starts. */
export function AdultCompanionCheck({ required, confirmed, onToggle }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => createAdultCompanionCheckStyles(colors), [colors]);
  if (!required) return null;
  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={s.icon}>
          <Icon name="users" size={18} color={colors.white} />
        </View>
        <View style={s.body}>
          <Text style={s.title}>Criança só com um adulto</Text>
          <AppText variant="small" tone="muted">
            O perfil criança é para acompanhar um passeio com um adulto responsável. O SafeWalk não
            deve ser usado para uma criança andar sozinha.
          </AppText>
        </View>
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        aria-checked={confirmed}
        style={({ pressed }) => [s.check, confirmed && s.checkOn, pressed && s.checkPressed]}
        onPress={onToggle}
      >
        <Icon
          name={confirmed ? 'check-square' : 'square'}
          size={22}
          color={confirmed ? colors.primaryText : colors.muted}
        />
        <Text style={s.checkText}>
          Confirmo que um adulto responsável acompanha a criança neste trajeto.
        </Text>
      </Pressable>
    </View>
  );
}
