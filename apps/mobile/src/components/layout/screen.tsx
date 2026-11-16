import { useMemo, type PropsWithChildren, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useTheme } from '@/theme/theme-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { AppText, Icon } from '@/components/ui/primitives';
import { BottomNav } from './bottom-nav';
import { createScreenStyles } from './screen.styles';

export function Screen({
  children,
  title,
  back = true,
  scroll = true,
  tabs = false,
  right,
  contentStyle,
  keyboardAvoiding = true,
}: PropsWithChildren<{
  title?: string;
  back?: boolean;
  scroll?: boolean;
  tabs?: boolean;
  right?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Desloca o conteúdo acima do teclado no nativo; desative se um ancestral já faz isso. */
  keyboardAvoiding?: boolean;
}>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createScreenStyles(colors), [colors]);
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <KeyboardAvoidingView
        enabled={keyboardAvoiding && Platform.OS !== 'web'}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardRoot}
      >
        {title ? (
          <View style={styles.header}>
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/inicio'))}
                hitSlop={4}
                style={styles.back}
              >
                <Icon name="chevron-left" />
              </Pressable>
            )}
            <AppText variant="heading" accessibilityRole="header" style={styles.heading}>
              {title}
            </AppText>
            {right}
          </View>
        ) : null}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios' && !keyboardAvoiding}
            contentContainerStyle={[styles.content, contentStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={styles.body}>{children}</View>
        )}
        {tabs && <BottomNav />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function LoadingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createScreenStyles(colors), [colors]);
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <AppText tone="muted">Preparando seu caminho…</AppText>
    </View>
  );
}
export function Protected({ children }: PropsWithChildren) {
  const { session, ready } = useAuth();
  if (!ready) return <LoadingScreen />;
  if (!session) return <Redirect href="/boas-vindas" />;
  return children;
}
