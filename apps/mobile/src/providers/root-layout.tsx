import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { AppProviders } from './app-providers';
import { AppFrame } from '@/components/layout/app-frame';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat, type ImageResult } from 'expo-image-manipulator';
import {
  ReportPhotoPickerProvider,
  type ReportPhotoPicker,
} from '@/features/reports/report-photo-picker';
import { isAuthPath } from '@/lib/auth-paths';
import { useTheme } from '@/theme/theme-provider';

const pickReportPhoto: ReportPhotoPicker = async () => {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      exif: false,
    });
  } catch {
    throw new Error(
      'Não foi possível acessar a galeria. Confira a permissão de fotos e tente novamente.',
    );
  }
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) throw new Error('Não foi possível abrir essa imagem. Escolha outra foto.');

  let compressed: ImageResult;
  try {
    const image = await ImageManipulator.manipulate(asset.uri, {
      maxWidth: 1600,
      maxHeight: 1600,
    }).renderAsync();
    compressed = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.78,
      base64: true,
    });
  } catch {
    throw new Error('Não foi possível preparar essa foto. Escolha outra imagem.');
  }
  if (!compressed.base64)
    throw new Error('Não foi possível preparar essa foto. Escolha outra imagem.');
  if (compressed.base64.length > 4 * 1024 * 1024)
    throw new Error('A imagem continua muito grande. Escolha uma foto menor.');
  return { uri: compressed.uri, base64: compressed.base64, mimeType: 'image/jpeg' };
};

function RootNavigator() {
  const { mode } = useTheme();
  const pathname = usePathname();
  const isAuthScreen = isAuthPath(pathname);
  return (
    <>
      <StatusBar style={isAuthScreen || mode === 'light' ? 'dark' : 'light'} />
      <AppFrame>
        <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      </AppFrame>
    </>
  );
}

export function RootLayout() {
  const [loaded, error] = useFonts({
    ...Feather.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  if (!loaded && !error) return null;
  return (
    <AppProviders>
      <ReportPhotoPickerProvider pickPhoto={pickReportPhoto}>
        <RootNavigator />
      </ReportPhotoPickerProvider>
    </AppProviders>
  );
}
