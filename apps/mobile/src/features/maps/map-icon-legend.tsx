import { Image, View } from 'react-native';
import { recordIconImages } from '@/components/map/record-icons';
import { AppText } from '@/components/ui/primitives';
import { mapIconLegendStyles as s } from './map-icon-legend.styles';

const items = [
  { id: 'signals', label: 'Semáforo' },
  { id: 'reports', label: 'Solicitação aberta' },
  { id: 'floods', label: 'Alagamento' },
  { id: 'sidewalks', label: 'Calçada' },
  { id: 'lighting', label: 'Iluminação' },
  { id: 'police', label: 'Delegacia' },
  { id: 'health', label: 'Hospital' },
  { id: 'accessibility', label: 'Acessibilidade' },
  { id: 'potholes', label: 'Buraco' },
  { id: 'obstacles', label: 'Obstáculo' },
  { id: 'brokenSidewalk', label: 'Calçada danificada' },
  { id: 'drains', label: 'Bueiro' },
  { id: 'trees', label: 'Árvore' },
  { id: 'history', label: 'Histórico' },
] as const;

/** Mesmas bolhas e símbolos desenhados no mapa. */
export function MapIconLegend() {
  return (
    <View style={s.list}>
      {items.map((item) => (
        <View key={item.id} style={s.item}>
          <View style={s[item.id]}>
            <Image
              source={recordIconImages[item.id]}
              style={s.icon}
              accessibilityIgnoresInvertColors
            />
          </View>
          <AppText variant="small">{item.label}</AppText>
        </View>
      ))}
    </View>
  );
}
