import { useMemo, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { isAuthPath } from '@/lib/auth-paths';
import { useTheme } from '@/theme/theme-provider';
import { createFrameStyles } from './app-frame.styles';
export function AppFrame({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const styles = useMemo(() => createFrameStyles(colors), [colors]);
  const pathname = usePathname();
  const isAuthScreen = isAuthPath(pathname);
  return (
    <View nativeID="safewalk-app-stage" style={[styles.stage, isAuthScreen && styles.authStage]}>
      <View
        nativeID={isAuthScreen ? 'safewalk-auth-frame' : 'safewalk-app-frame'}
        style={[
          styles.frame,
          isAuthScreen && styles.authFrame,
          pathname.startsWith('/prefeitura') && styles.wide,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
