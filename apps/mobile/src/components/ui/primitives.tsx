import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/theme-provider';
import { createPrimitiveStyles } from './primitives.styles';
import { errorMessage } from '@/lib/error-message';

export function useUiStyles() {
  const { colors } = useTheme();
  return useMemo(() => createPrimitiveStyles(colors), [colors]);
}
export function AppText({
  variant,
  tone,
  style,
  ...props
}: TextProps & {
  variant?: 'title' | 'heading' | 'subtitle' | 'small' | 'label';
  tone?: 'muted' | 'primary' | 'danger' | 'success';
}) {
  const styles = useUiStyles();
  return (
    <Text
      {...props}
      style={[
        styles.text,
        variant && styles[variant],
        tone === 'muted' && styles.muted,
        tone === 'primary' && styles.primaryText,
        tone === 'danger' && styles.dangerText,
        tone === 'success' && styles.successText,
        style,
      ]}
    />
  );
}
export function Icon({
  name,
  size = 20,
  color,
}: {
  name: ComponentProps<typeof Feather>['name'];
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={color ?? colors.text} />;
}
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  containerStyle,
  textStyle,
  pressedStyle,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Feather>['name'];
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
}) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'ghost' && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        containerStyle,
        pressed && styles.buttonPressed,
        pressed && pressedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : icon ? (
        <Icon
          name={icon}
          color={variant === 'secondary' || variant === 'ghost' ? colors.text : colors.white}
        />
      ) : null}
      <Text
        style={[
          styles.buttonText,
          (variant === 'secondary' || variant === 'ghost') && styles.buttonSecondaryText,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  multiline,
  onFocus,
  onBlur,
  style,
  focusStyle,
  placeholderTextColor,
  ...props
}: ComponentProps<typeof TextInput> & { label: string; focusStyle?: StyleProp<TextStyle> }) {
  const styles = useUiStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        {...props}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        accessibilityLabel={label}
        placeholderTextColor={placeholderTextColor ?? colors.muted}
        style={[
          styles.input,
          style,
          focused && (focusStyle ?? styles.inputFocused),
          multiline && styles.multiline,
        ]}
      />
    </View>
  );
}
export function Card({ style, ...props }: ViewProps) {
  const styles = useUiStyles();
  return <View {...props} style={[styles.card, style]} />;
}
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const s = useUiStyles();
  return (
    <View
      style={[
        s.badge,
        tone === 'success' && s.successBadge,
        tone === 'warning' && s.warningBadge,
        tone === 'danger' && s.dangerBadge,
      ]}
    >
      <AppText
        style={[
          s.badgeText,
          tone === 'success' && s.successText,
          tone === 'warning' && s.warningText,
          tone === 'danger' && s.dangerText,
        ]}
      >
        {label}
      </AppText>
    </View>
  );
}
export function ErrorNotice({ error }: { error: unknown }) {
  const s = useUiStyles();
  if (!error) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.error}>
      <AppText tone="danger">{errorMessage(error)}</AppText>
    </View>
  );
}
