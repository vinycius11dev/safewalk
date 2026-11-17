import { useMemo, useState, type ComponentProps } from 'react';
import { Image, Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { canSendToGovernment, reportLabels, type ReportType } from '@safewalk/contracts';
import { Screen, Protected } from '@/components/layout/screen';
import { AppText, Button, Card, ErrorNotice, Field, Icon, Badge } from '@/components/ui/primitives';
import { useTheme } from '@/theme/theme-provider';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { useCreateReport, useUploadReportPhoto } from './use-reports';
import { createReportStyles } from './reports.styles';
import { useReportDraft } from './use-report-draft';
import { useReportPhotoPicker } from './report-photo-picker';
import type { ReportPhotoAsset } from './reports.service';

const reportIcons: Record<ReportType, ComponentProps<typeof Icon>['name']> = {
  robbery: 'alert-circle',
  aggression: 'flag',
  harassment: 'flag',
  flood: 'cloud-rain',
  pothole: 'alert-triangle',
  traffic_light: 'zap-off',
  lighting: 'sun',
  sidewalk: 'tool',
  construction: 'flag',
  obstruction: 'flag',
  other: 'flag',
};

export function ReportScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createReportStyles(colors), [colors]);
  const { draft, locationConfirmed, update, reset } = useReportDraft();
  const settings = useProfileSettings();
  const { type, description, address } = draft;
  const create = useCreateReport();
  const upload = useUploadReportPhoto();
  const pickPhoto = useReportPhotoPicker();
  const [photo, setPhoto] = useState<ReportPhotoAsset | null>(null);
  const [photoPickerError, setPhotoPickerError] = useState<Error | null>(null);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const canShare = Boolean(settings.data?.contributeReports);
  const submit = async () => {
    if (!locationConfirmed || address.trim().length < 3) return;
    try {
      let reportId = savedReportId;
      if (!reportId) {
        const report = await create.mutateAsync(draft);
        reportId = report.id;
        setSavedReportId(reportId);
      }
      if (photo) await upload.mutateAsync({ id: reportId, asset: photo });
      reset();
      router.replace({ pathname: '/relato-enviado/[id]', params: { id: reportId } });
    } catch {
      // On photo failure keep the saved report id so retrying cannot create a duplicate.
    }
  };
  return (
    <Protected>
      <Screen title="O que você viu?" back={false} tabs>
        <Badge label="Relato comunitário · sem envio ao SP156" />
        <View style={s.types}>
          {(Object.entries(reportLabels) as [ReportType, string][]).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ checked: type === key }}
              aria-checked={type === key}
              style={[s.type, type === key && s.selected]}
              onPress={() => update({ type: key })}
            >
              <Icon
                name={reportIcons[key]}
                color={type === key ? colors.primaryText : colors.muted}
              />
              <AppText variant="label">{label}</AppText>
            </Pressable>
          ))}
        </View>
        <Card>
          <View style={s.locationRow}>
            <Icon name="map-pin" color={colors.primaryText} />
            <View style={s.locationText}>
              <AppText variant="label">{address || 'Selecione o local no mapa'}</AppText>
              <AppText variant="small" tone="muted">
                {locationConfirmed
                  ? 'Ponto escolhido no mapa · endereço informado por você'
                  : 'Nenhuma localização confirmada'}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajustar local do relato"
              onPress={() => router.push('/ajustar-local')}
            >
              <AppText tone="primary" variant="label">
                Ajustar
              </AppText>
            </Pressable>
          </View>
        </Card>
        <Field
          label="Detalhes (opcional)"
          value={description}
          onChangeText={(value) => update({ description: value })}
          multiline
          placeholder="O que outras pessoas precisam saber?"
          maxLength={1000}
        />
        <Card>
          <View style={s.locationRow}>
            <View style={s.locationText}>
              <AppText variant="label">Foto do local (opcional)</AppText>
              <AppText tone="muted" variant="small">
                Evite rostos, placas e informações pessoais. A foto também pode ser vista com o
                relato compartilhado.
              </AppText>
            </View>
            <Button
              label={photo ? 'Trocar foto' : 'Escolher foto'}
              icon="camera"
              variant="secondary"
              disabled={!pickPhoto}
              onPress={() => {
                if (pickPhoto)
                  void pickPhoto()
                    .then((asset) => {
                      if (asset) setPhoto(asset);
                      setPhotoPickerError(null);
                    })
                    .catch((error: unknown) =>
                      setPhotoPickerError(
                        new Error(
                          error instanceof Error && error.message.trim()
                            ? error.message
                            : 'Não foi possível abrir a galeria. Confira a permissão de fotos.',
                        ),
                      ),
                    );
              }}
            />
          </View>
          {photo && (
            <Image
              accessibilityLabel="Prévia da foto do relato"
              source={{ uri: photo.uri ?? `data:${photo.mimeType};base64,${photo.base64}` }}
              resizeMode="cover"
              style={s.photoPreview}
            />
          )}
        </Card>
        <Card>
          <View style={s.locationRow}>
            <View style={s.locationText}>
              <AppText variant="label">Compartilhar com pessoas próximas</AppText>
              <AppText tone="muted" variant="small">
                Seu nome fica oculto e o ponto no mapa é aproximado. Outros usuários podem indicar
                se ainda existe.
              </AppText>
              {!canShare && (
                <AppText tone="muted" variant="small">
                  Ative “Contribuir com relatos comunitários” nas preferências de privacidade para
                  compartilhar.
                </AppText>
              )}
            </View>
            <Switch
              accessibilityLabel="Compartilhar relato com pessoas próximas"
              value={draft.shareWithCommunity}
              onValueChange={(value) => {
                update({ shareWithCommunity: value });
              }}
              disabled={!canShare}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>
        {canSendToGovernment(type) && (
          <Card>
            <View style={s.locationRow}>
              <View style={s.locationText}>
                <AppText variant="label">Enviar ao painel da Prefeitura</AppText>
                <AppText tone="muted" variant="small">
                  O local exato e a foto vão para o painel da equipe de zeladoria. Seu nome e seu
                  contato não vão. O painel é uma demonstração, não um canal oficial, e não abre
                  protocolo no SP156.
                </AppText>
              </View>
              <Switch
                accessibilityLabel="Enviar relato ao painel da Prefeitura"
                value={draft.shareWithGovernment}
                onValueChange={(value) => {
                  update({ shareWithGovernment: value });
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          </Card>
        )}
        <View style={s.locationRow}>
          <Icon name="shield" color={colors.success} />
          <View style={s.locationText}>
            <AppText variant="label">Anônimo para outros usuários</AppText>
            <AppText tone="muted" variant="small">
              A autoria é guardada no servidor. Relatos compartilhados são de usuários, não são
              verificados oficialmente e podem ficar desatualizados.
            </AppText>
          </View>
        </View>
        <ErrorNotice error={create.error ?? upload.error ?? photoPickerError} />
        {savedReportId && upload.isError && (
          <AppText tone="danger" variant="small">
            O relato foi salvo, mas a foto não subiu. Tente enviar a foto novamente.
          </AppText>
        )}
        <Button
          label={savedReportId && photo ? 'Tentar enviar foto' : 'Enviar relato'}
          icon="send"
          disabled={
            !locationConfirmed || address.trim().length < 3 || (savedReportId !== null && !photo)
          }
          loading={create.isPending || upload.isPending}
          onPress={() => void submit()}
        />
      </Screen>
    </Protected>
  );
}
