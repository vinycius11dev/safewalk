import { useMemo, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme/theme-provider';
import { AppText } from '@/components/ui/primitives';
import { createNavStyles } from './bottom-nav.styles';
const items: { label: string; path: Href; icon: ComponentProps<typeof Feather>['name'] }[] = [
  { label: 'Início', path: '/inicio', icon: 'home' },
  { label: 'Rotas', path: '/buscar', icon: 'navigation' },
  { label: 'Relatar', path: '/relatar', icon: 'plus-circle' },
  { label: 'Contatos', path: '/contatos', icon: 'users' },
  { label: 'Segurança', path: '/seguranca', icon: 'shield' },
];
export function BottomNav() {
  const { colors } = useTheme();
  const styles = useMemo(() => createNavStyles(colors), [colors]);
  const pathname = usePathname();
  return (
    <View accessibilityRole="tablist" style={styles.nav}>
      {items.map((item) => {
        const selected = pathname === item.path;
        return (
          <Pressable
            key={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => router.replace(item.path)}
            style={styles.item}
          >
            <Feather
              name={item.icon}
              size={23}
              color={selected ? colors.primaryText : colors.muted}
            />
            <AppText
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={[styles.label, selected && styles.activeLabel]}
            >
              {item.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
