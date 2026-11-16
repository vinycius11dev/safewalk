import { useMemo, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Protected } from '@/components/layout/screen';
import { AppText, Badge, Icon } from '@/components/ui/primitives';
import { SafeWalkMark } from '@/components/ui/safewalk-mark';
import { useTheme } from '@/theme/theme-provider';
import { createMunicipalityStyles } from './municipality.styles';

const pages: {
  key: string;
  label: string;
  href: Href;
  icon: 'grid' | 'map-pin' | 'bar-chart-2' | 'radio';
}[] = [
  { key: 'dashboard', label: 'Visão geral', href: '/prefeitura', icon: 'grid' },
  {
    key: 'maintenance',
    label: 'Zeladoria · SP156',
    href: { pathname: '/prefeitura', params: { type: 'maintenance' } },
    icon: 'grid',
  },
  { key: 'critical', label: 'Pontos críticos', href: '/prefeitura-ponto', icon: 'map-pin' },
  { key: 'report', label: 'Relatórios', href: '/prefeitura-relatorio', icon: 'bar-chart-2' },
  { key: 'central', label: 'Segurança · GCM', href: '/prefeitura-central', icon: 'radio' },
];
export function MunicipalityShell({
  children,
  section,
  title,
  subtitle,
}: PropsWithChildren<{ section: string; title: string; subtitle: string }>) {
  const { colors } = useTheme();
  const s = useMemo(() => createMunicipalityStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const wide = width >= 1050;
  const navigationItems = pages.map((page) => (
    <Pressable
      key={page.key}
      accessibilityRole="tab"
      accessibilityState={{ selected: section === page.key }}
      style={[wide ? s.navItem : s.navChip, section === page.key && s.navItemActive]}
      onPress={() => router.navigate(page.href)}
    >
      <Icon
        name={page.icon}
        size={17}
        color={section === page.key ? colors.primaryText : colors.muted}
      />
      <AppText variant="label" tone={section === page.key ? 'primary' : 'muted'}>
        {page.label}
      </AppText>
    </Pressable>
  ));
  return (
    <Protected>
      <SafeAreaView style={[s.root, wide && s.shellWide]} edges={['top', 'bottom']}>
        {wide ? (
          <View style={s.sidebar}>
            <View style={s.sidebarBrand}>
              <View style={s.filters}>
                <SafeWalkMark size={28} />
                <AppText variant="heading">SafeWalk</AppText>
              </View>
              <AppText variant="small" tone="muted">
                Painel da Prefeitura
              </AppText>
              <Badge label="DEMONSTRAÇÃO" tone="warning" />
            </View>
            <View style={s.sidebarNavigation}>
              {navigationItems}
              <Pressable
                accessibilityRole="button"
                style={s.navItem}
                onPress={() => router.push('/prefeitura-central')}
              >
                <Icon name="video" size={17} color={colors.muted} />
                <AppText variant="label" tone="muted">
                  Câmeras Smart Sampa
                </AppText>
              </Pressable>
            </View>
            <View style={s.sidebarAccount}>
              <View style={s.avatar}>
                <AppText style={s.avatarLetter}>SÉ</AppText>
              </View>
              <AppText variant="label">Subprefeitura Sé</AppText>
              <AppText variant="small" tone="muted">
                Acesso demonstrativo
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/seguranca')}
                style={s.navItem}
              >
                <Icon name="arrow-left" size={16} />
                <AppText variant="small">Voltar ao aplicativo</AppText>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={s.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar ao aplicativo"
                onPress={() => router.replace('/seguranca')}
                style={s.back}
              >
                <Icon name="arrow-left" />
              </Pressable>
              <SafeWalkMark size={28} />
              <View style={s.headerText}>
                <AppText variant="heading">SafeWalk · Prefeitura</AppText>
                <AppText variant="small" tone="muted">
                  Subprefeitura Sé · Bela Vista
                </AppText>
              </View>
              <Badge label="DEMONSTRAÇÃO" tone="warning" />
            </View>
            {/* Wraps instead of scrolling sideways, so the active section is never hidden. */}
            <View style={[s.navigation, s.navigationContent]}>{navigationItems}</View>
          </>
        )}
        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.content, wide && s.contentWide]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.pageHeading}>
            <AppText variant="title">{title}</AppText>
            <AppText tone="muted">{subtitle}</AppText>
          </View>
          {children}
          <View style={s.disclaimer}>
            <Icon name="info" size={16} color={colors.muted} />
            <AppText variant="small" tone="muted" style={s.flex}>
              Ambiente demonstrativo. Os dados urbanos são fictícios; GCM, Smart Sampa e SP156 não
              são acionados. Registros da conta são exibidos apenas ao seu titular.
            </AppText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Protected>
  );
}
