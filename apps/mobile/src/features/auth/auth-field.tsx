import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText, Icon } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { createAuthFieldStyles } from './auth-field.styles';

type AuthFieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  compact: boolean;
};

export function AuthField({
  label,
  icon,
  compact,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}: AuthFieldProps) {
  const { colors } = useTheme();
  const s = useMemo(() => createAuthFieldStyles(colors, compact), [colors, compact]);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={s.root}>
      <AppText style={s.label}>{label}</AppText>
      <View style={[s.control, focused && s.focused]}>
        <Icon name={icon} size={18} color={focused ? colors.primary : colors.muted} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          secureTextEntry={secureTextEntry && !visible}
          placeholderTextColor={colors.muted}
          style={s.input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setVisible((value) => !value)}
            style={({ pressed }) => [s.toggle, pressed && s.togglePressed]}
          >
            <Icon name={visible ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
