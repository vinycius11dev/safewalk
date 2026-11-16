import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Switch, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { reportLabels, type Coordinates, type ReportInput } from '@safewalk/contracts';
import { AppText, Badge, Button, Card, ErrorNotice, Field, Icon } from '@/components/ui/primitives';
import { useAuth } from '@/features/auth/auth-provider';
import { useProfileSettings } from '@/features/auth/use-profile-settings';
import { useTheme } from '@/theme/theme-provider';
import { reportsService, type ReportPhotoAsset } from './reports.service';
import {
  useCommunityReportFeedback,
  useCreateReport,
  useFlagCommunityReport,
  useNearbyCommunityReports,
  useUploadReportPhoto,
} from './use-reports';
import { useReportPhotoPicker, type ReportPhotoPicker } from './report-photo-picker';
import { createCommunityReportStyles } from './community-reports.styles';

function relativeReportAge(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

type QuickObstacleReportProps = {
  visible: boolean;
  location: Coordinates | null;
  locationAccuracyMeters?: number | null;
  address: string;
  onClose: () => void;
  onSubmitted?: (reportId: string) => void;
  onPickPhoto?: ReportPhotoPicker;
};

export function QuickObstacleReport({
  visible,
  location,
  locationAccuracyMeters,
  address,
  onClose,
  onSubmitted,
  onPickPhoto,
}: QuickObstacleReportProps) {
  const { colors } = useTheme();
  const s = useMemo(() => createCommunityReportStyles(colors), [colors]);
  const settings = useProfileSettings();
  const create = useCreateReport();
  const upload = useUploadReportPhoto();
  const contextPicker = useReportPhotoPicker();
  const pickPhoto = onPickPhoto ?? contextPicker;
  const [description, setDescription] = useState('');
  const [share, setShare] = useState(false);
  const [photo, setPhoto] = useState<ReportPhotoAsset | null>(null);
  const [createdReportId, setCreatedReportId] = useState<string | null>(null);
  const [photoPickerError, setPhotoPickerError] = useState<Error | null>(null);
  const canShare = Boolean(settings.data?.contributeReports);
  const isWorking = create.isPending || upload.isPending;
  const dismiss = () => {
    if (isWorking) return;
    setDescription('');
    setShare(false);
    setPhoto(null);
    setCreatedReportId(null);
    setPhotoPickerError(null);
    create.reset();
    upload.reset();
    onClose();
  };

  const choosePhoto = async () => {
    if (!pickPhoto) return;
    try {
      const selected = await pickPhoto();
      if (selected) setPhoto(selected);
      setPhotoPickerError(null);
    } catch (error) {
      setPhotoPickerError(
        new Error(
          error instanceof Error && error.message.trim()
            ? error.message
            : 'Não foi possível abrir a galeria. Confira a permissão de fotos.',
        ),
      );
    }
  };
  const submit = async () => {
    if (!location || address.trim().length < 3) return;
    try {
      let reportId = createdReportId;
      if (!reportId) {
        const input: ReportInput = {
          type: 'obstruction',
          description: description.trim(),
          address: address.trim(),
          location,
          shareWithCommunity: share && canShare,
          shareWithGovernment: false,
        };
        const report = await create.mutateAsync(input);
        reportId = report.id;
        setCreatedReportId(reportId);
      }
      if (photo) await upload.mutateAsync({ id: reportId, asset: photo });
      onSubmitted?.(reportId);
      setDescription('');
      setShare(false);
      setPhoto(null);
      setCreatedReportId(null);
      setPhotoPickerError(null);
      create.reset();
      upload.reset();
      onClose();
    } catch {
      // Keep the created id and photo in state so retrying only retries the upload.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={s.backdrop}>
        <Card style={s.quickCard}>
          <View style={s.headingRow}>
            <Icon name="alert-triangle" color={colors.warning} size={24} />
            <View style={s.grow}>
              <AppText variant="subtitle">Avisar sobre um bloqueio</AppText>
              <AppText variant="small" tone="muted">
                Registre o ponto para ajudar quem vem depois.
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={dismiss}>
              <Icon name="x" color={colors.muted} />
            </Pressable>
          </View>
          <View style={s.info}>
            <Icon name="map-pin" size={17} color={colors.primaryText} />
            <AppText variant="small" style={s.grow}>
              {address || 'Localização atual indisponível'}
            </AppText>
          </View>
          {locationAccuracyMeters !== undefined && locationAccuracyMeters !== null && (
            <AppText variant="small" tone="muted">
              Precisão do GPS: cerca de ±{Math.round(locationAccuracyMeters)} m. O ponto
              compartilhado será aproximado.
            </AppText>
          )}
          <Field
            label="O que está bloqueando a passagem? (opcional)"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            placeholder="Ex.: obra ocupando toda a calçada"
          />
          <View style={s.controlRow}>
            <View style={s.grow}>
              <AppText variant="label">Adicionar foto (opcional)</AppText>
              <AppText variant="small" tone="muted">
                Evite incluir rostos, placas e dados pessoais.
              </AppText>
            </View>
            <Button
              label={photo ? 'Trocar foto' : 'Escolher foto'}
              icon="camera"
              variant="secondary"
              disabled={!pickPhoto}
              onPress={() => void choosePhoto()}
            />
          </View>
          {photo && (
            <Image
              accessibilityLabel="Prévia da foto do obstáculo"
              source={{ uri: photo.uri ?? `data:${photo.mimeType};base64,${photo.base64}` }}
              resizeMode="cover"
              style={s.photoPreview}
            />
          )}
          <View style={s.controlRow}>
            <View style={s.grow}>
              <AppText variant="label">Pedir confirmação à comunidade</AppText>
              <AppText variant="small" tone="muted">
                Seu nome não será exibido. O ponto mostrado será aproximado.
              </AppText>
              {!canShare && (
                <AppText variant="small" tone="muted">
                  Ative “Contribuir com relatos comunitários” em Privacidade para compartilhar.
                </AppText>
              )}
            </View>
            <Switch
              accessibilityLabel="Compartilhar relato com a comunidade"
              value={share}
              onValueChange={setShare}
              disabled={!canShare}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
          <Badge label="Relato comunitário · sem verificação oficial" tone="warning" />
          <ErrorNotice error={create.error ?? upload.error ?? photoPickerError} />
          {createdReportId && upload.isError && (
            <AppText tone="danger" variant="small">
              O relato foi salvo, mas a foto não subiu. Tente enviar a foto novamente.
            </AppText>
          )}
          <View style={s.headingRow}>
            <Button label="Cancelar" variant="ghost" onPress={dismiss} />
            <View style={s.grow} />
            <Button
              label={createdReportId && photo ? 'Tentar enviar foto' : 'Enviar relato'}
              icon="send"
              loading={isWorking}
              disabled={
                !location || address.trim().length < 3 || (createdReportId !== null && !photo)
              }
              onPress={() => void submit()}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

function CommunityReportPhoto({ reportId }: { reportId: string }) {
  const { session } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => createCommunityReportStyles(colors), [colors]);
  const query = useQuery({
    queryKey: ['community-report-photo', session?.user.id, reportId],
    enabled: false,
    queryFn: ({ signal }) => reportsService.photo(session?.token ?? '', reportId, signal),
    staleTime: 5 * 60_000,
  });
  if (!query.data)
    return (
      <>
        {query.isError && <ErrorNotice error={query.error} />}
        <Button
          label={query.isError ? 'Tentar abrir a foto' : 'Ver foto enviada'}
          variant="ghost"
          icon="image"
          loading={query.isFetching}
          onPress={() => void query.refetch()}
        />
      </>
    );
  return (
    <Image
      accessibilityLabel="Foto enviada por outra pessoa, ainda não verificada"
      source={{ uri: query.data }}
      resizeMode="cover"
      style={s.photoPreview}
    />
  );
}

function CommunityReportCard({
  report,
}: {
  report: NonNullable<ReturnType<typeof useNearbyCommunityReports>['data']>[number];
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createCommunityReportStyles(colors), [colors]);
  const feedback = useCommunityReportFeedback();
  const flag = useFlagCommunityReport();
  const [flagSent, setFlagSent] = useState(false);
  const distance =
    report.distanceMeters < 1000
      ? `${report.distanceMeters} m`
      : `${(report.distanceMeters / 1000).toFixed(1).replace('.', ',')} km`;
  return (
    <Card>
      <View style={s.reportHeader}>
        <View style={s.reportText}>
          <AppText variant="subtitle">{reportLabels[report.type]}</AppText>
          <AppText variant="small" tone="muted">
            {report.description || 'Sem descrição adicional'}
          </AppText>
        </View>
        <AppText variant="small" tone="muted" style={s.distance}>
          {distance}
        </AppText>
      </View>
      <View style={s.summary}>
        <Badge label="Relato da comunidade · não verificado" tone="warning" />
        <AppText variant="small" tone="muted">
          {report.confirmationCount} continuam · {report.resolvedCount} já passaram ·{' '}
          {report.notFoundCount} não encontraram · {relativeReportAge(report.createdAt)}
        </AppText>
      </View>
      {report.hasPhoto && <CommunityReportPhoto reportId={report.id} />}
      <AppText variant="small" tone="muted">
        O local é aproximado. Confirme apenas se passou por lá.
      </AppText>
      <View style={s.choiceRow}>
        {(
          [
            ['present', 'Continua aqui'],
            ['resolved', 'Já passou'],
            ['not_found', 'Não encontrei'],
          ] as const
        ).map(([choice, label]) => (
          <Pressable
            key={choice}
            accessibilityRole="button"
            accessibilityState={{ selected: report.myChoice === choice }}
            style={[s.choice, report.myChoice === choice && s.choiceSelected]}
            disabled={feedback.isPending}
            onPress={() => feedback.mutate({ id: report.id, choice })}
          >
            <AppText variant="small" tone={report.myChoice === choice ? 'primary' : 'muted'}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {report.myChoice && (
        <AppText variant="small" tone="success">
          Sua resposta foi registrada.
        </AppText>
      )}
      <ErrorNotice error={feedback.error ?? flag.error} />
      {flagSent ? (
        <AppText variant="small" tone="muted">
          Sinalização registrada. Três sinalizações de contas diferentes ocultam o relato
          automaticamente.
        </AppText>
      ) : (
        <Pressable
          accessibilityRole="button"
          style={s.photoAction}
          disabled={flag.isPending}
          onPress={() => flag.mutate(report.id, { onSuccess: () => setFlagSent(true) })}
        >
          <AppText variant="small" tone="muted">
            Sinalizar informação inadequada
          </AppText>
        </Pressable>
      )}
    </Card>
  );
}

export function NearbyReportPrompt({
  location,
  radiusMeters = 1200,
  promptDistanceMeters = 220,
}: {
  location: Coordinates | null;
  radiusMeters?: number;
  promptDistanceMeters?: number;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createCommunityReportStyles(colors), [colors]);
  const reports = useNearbyCommunityReports(location, radiusMeters);
  const feedback = useCommunityReportFeedback();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const candidate = reports.data?.find(
    (report) =>
      report.distanceMeters <= promptDistanceMeters &&
      !report.myChoice &&
      report.id !== dismissedId,
  );
  if (!candidate) return null;
  const distance = Math.max(10, Math.round(candidate.distanceMeters / 10) * 10);
  return (
    <Card style={s.nearbyPrompt}>
      <View style={s.headingRow}>
        <Icon name="alert-triangle" color={colors.warning} size={20} />
        <View style={s.grow}>
          <AppText variant="label">Relato da comunidade por perto</AppText>
          <AppText variant="small" tone="muted">
            {reportLabels[candidate.type]} · cerca de {distance} m
          </AppText>
        </View>
      </View>
      <AppText variant="small">
        Se você passou por esse trecho, a condição ainda está acontecendo?
      </AppText>
      {candidate.description.trim() !== '' && (
        <AppText variant="small" tone="muted" numberOfLines={2}>
          {candidate.description}
        </AppText>
      )}
      <View style={s.choiceRow}>
        {(
          [
            ['present', 'Ainda existe'],
            ['resolved', 'Foi resolvido'],
            ['not_found', 'Não encontrei'],
          ] as const
        ).map(([choice, label]) => (
          <Pressable
            key={choice}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${reportLabels[candidate.type]}`}
            disabled={feedback.isPending}
            style={s.choice}
            onPress={() => feedback.mutate({ id: candidate.id, choice })}
          >
            <AppText variant="small" tone="primary">
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      <ErrorNotice error={feedback.error} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dispensar pergunta sobre relato próximo"
        onPress={() => setDismissedId(candidate.id)}
      >
        <AppText variant="small" tone="muted">
          Agora não
        </AppText>
      </Pressable>
    </Card>
  );
}

export function NearbyReportPrompts({
  location,
  radiusMeters = 1200,
  limit = 10,
}: {
  location: Coordinates | null;
  radiusMeters?: number;
  limit?: number;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createCommunityReportStyles(colors), [colors]);
  const reports = useNearbyCommunityReports(location, radiusMeters);
  if (!location) return null;
  return (
    <View style={s.reportList}>
      <AppText variant="heading">Relatos próximos</AppText>
      <AppText variant="small" tone="muted">
        Contribuições de outras pessoas. Não são dados oficiais nem confirmam sozinhas a condição da
        via.
      </AppText>
      {reports.isPending && <ActivityIndicator color={colors.primary} />}
      <ErrorNotice error={reports.error} />
      {reports.data?.slice(0, Math.max(1, limit)).map((report) => (
        <CommunityReportCard key={report.id} report={report} />
      ))}
      {!reports.isPending && !reports.isError && reports.data?.length === 0 && (
        <AppText variant="small" tone="muted">
          Nenhum relato comunitário recente por perto.
        </AppText>
      )}
    </View>
  );
}
