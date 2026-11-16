import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import {
  canSendToGovernment,
  type Coordinates,
  type GovernmentStatus,
  type ReportInput,
  type ReportType,
} from '@safewalk/contracts';
import { pool, transaction } from '../../database/pool.js';
import { reportValidityHours } from '../../domain/trip-state.js';
import { AppError } from '../../middleware/errors.js';
import {
  removeReportPhoto,
  saveReportPhoto,
  type ReportPhotoMime,
} from './report-photo-storage.js';

type ReportResponse = ReportInput & {
  id: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'resolved';
  /** Andamento no painel da Prefeitura; nulo quando o relato não foi enviado a ele. */
  governmentStatus: GovernmentStatus | null;
  governmentUpdatedAt: string | null;
  hasPhoto: boolean;
  confirmationCount: number;
  resolvedCount: number;
  notFoundCount: number;
};
export type CommunityReport = {
  id: string;
  type: ReportType;
  description: string;
  location: Coordinates;
  distanceMeters: number;
  createdAt: string;
  expiresAt: string;
  hasPhoto: boolean;
  confirmationCount: number;
  resolvedCount: number;
  notFoundCount: number;
  myChoice: 'present' | 'resolved' | 'not_found' | null;
};
type FeedbackChoice = 'present' | 'resolved' | 'not_found';
type ReportRow = RowDataPacket & {
  id: string;
  user_id: string;
  type: ReportType;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  public_latitude: string | null;
  public_longitude: string | null;
  share_with_community: number | boolean;
  share_with_government: number | boolean;
  gov_status: GovernmentStatus;
  gov_updated_at: Date | null;
  created_at: Date;
  expires_at: Date;
  status: 'active' | 'resolved';
  has_photo?: number | boolean;
  confirmation_count?: number | string;
  resolved_count?: number | string;
  not_found_count?: number | string;
  my_choice?: FeedbackChoice | null;
};
const reportSelect = `SELECT r.*,
  EXISTS(SELECT 1 FROM report_attachments a WHERE a.report_id = r.id) AS has_photo,
  (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'present') AS confirmation_count,
  (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'resolved') AS resolved_count,
  (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'not_found') AS not_found_count
  FROM reports r`;

function serialize(row: ReportRow): ReportResponse {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    address: row.address,
    location: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    shareWithCommunity: Boolean(row.share_with_community),
    shareWithGovernment: Boolean(row.share_with_government),
    governmentStatus: row.share_with_government ? row.gov_status : null,
    governmentUpdatedAt:
      row.share_with_government && row.gov_updated_at ? row.gov_updated_at.toISOString() : null,
    hasPhoto: Boolean(row.has_photo),
    confirmationCount: Number(row.confirmation_count ?? 0),
    resolvedCount: Number(row.resolved_count ?? 0),
    notFoundCount: Number(row.not_found_count ?? 0),
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    status: row.status,
  };
}

function coarsen(value: number) {
  return Math.round(value * 1000) / 1000;
}
function distanceMeters(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export async function listReports(userId: string): Promise<ReportResponse[]> {
  const [rows] = await pool.execute<ReportRow[]>(
    `${reportSelect} WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 50`,
    [userId],
  );
  return rows.map(serialize);
}

export async function getReport(userId: string, id: string): Promise<ReportResponse> {
  const [rows] = await pool.execute<ReportRow[]>(
    `${reportSelect} WHERE r.user_id = ? AND r.id = ?`,
    [userId, id],
  );
  if (!rows[0]) throw new AppError(404, 'REPORT_NOT_FOUND', 'Relato não encontrado.');
  return serialize(rows[0]);
}

export async function resolveReport(userId: string, id: string): Promise<ReportResponse> {
  await getReport(userId, id);
  await pool.execute("UPDATE reports SET status = 'resolved' WHERE user_id = ? AND id = ?", [
    userId,
    id,
  ]);
  return getReport(userId, id);
}

export async function createReport(userId: string, input: ReportInput): Promise<ReportResponse> {
  if (input.shareWithGovernment && !canSendToGovernment(input.type))
    throw new AppError(
      400,
      'GOVERNMENT_TYPE_NOT_SUPPORTED',
      'Este tipo de relato não vai para o painel da Prefeitura. Crimes são assunto de polícia.',
    );
  if (input.shareWithCommunity) {
    const [settings] = await pool.execute<RowDataPacket[]>(
      'SELECT contribute_reports FROM users WHERE id = ?',
      [userId],
    );
    if (!settings[0] || !settings[0].contribute_reports)
      throw new AppError(
        403,
        'COMMUNITY_SHARING_DISABLED',
        'Ative “Contribuir com relatos comunitários” nas preferências de privacidade para compartilhar este relato.',
      );
    const [daily] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM reports WHERE user_id = ? AND share_with_community = 1 AND created_at >= TIMESTAMPADD(HOUR, -24, UTC_TIMESTAMP(3))',
      [userId],
    );
    if (Number(daily[0]?.total ?? 0) >= 20)
      throw new AppError(429, 'REPORT_LIMIT', 'Você já enviou vários relatos hoje. Tente amanhã.');
  }

  const id = randomUUID();
  const createdAt = new Date();
  const validityHours = input.type === 'obstruction' ? 6 : reportValidityHours(input.type);
  const expiresAt = new Date(createdAt.getTime() + validityHours * 3_600_000);
  const publicLatitude = input.shareWithCommunity ? coarsen(input.location.latitude) : null;
  const publicLongitude = input.shareWithCommunity ? coarsen(input.location.longitude) : null;
  await transaction(async (db) => {
    await db.execute(
      `INSERT INTO reports
        (id, user_id, type, description, address, latitude, longitude, created_at, expires_at,
         share_with_community, public_latitude, public_longitude, community_status,
         share_with_government, gov_status, gov_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?, 'received', ?)`,
      [
        id,
        userId,
        input.type,
        input.description,
        input.address,
        input.location.latitude,
        input.location.longitude,
        createdAt,
        expiresAt,
        input.shareWithCommunity,
        publicLatitude,
        publicLongitude,
        input.shareWithGovernment,
        input.shareWithGovernment ? createdAt : null,
      ],
    );
    if (input.shareWithGovernment)
      await db.execute(
        `INSERT INTO report_admin_events (report_id, admin_id, from_status, to_status, note, created_at)
         VALUES (?, NULL, NULL, 'received', 'Relato enviado pelo aplicativo.', ?)`,
        [id, createdAt],
      );
  });
  return {
    id,
    ...input,
    governmentStatus: input.shareWithGovernment ? 'received' : null,
    governmentUpdatedAt: input.shareWithGovernment ? createdAt.toISOString() : null,
    hasPhoto: false,
    confirmationCount: 0,
    resolvedCount: 0,
    notFoundCount: 0,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active',
  };
}

export async function nearbyCommunityReports(
  userId: string,
  center: Coordinates,
  radiusMeters: number,
): Promise<CommunityReport[]> {
  const latitudeDelta = radiusMeters / 110_500;
  const longitudeDelta =
    radiusMeters / Math.max(1, 111_320 * Math.cos((center.latitude * Math.PI) / 180));
  const [rows] = await pool.execute<ReportRow[]>(
    `SELECT r.id, r.type, r.description, r.public_latitude, r.public_longitude,
      r.created_at, r.expires_at,
      EXISTS(SELECT 1 FROM report_attachments a WHERE a.report_id = r.id) AS has_photo,
      (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'present') AS confirmation_count,
      (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'resolved') AS resolved_count,
      (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'not_found') AS not_found_count,
      (SELECT f.choice FROM report_feedback f WHERE f.report_id = r.id AND f.user_id = ?) AS my_choice
     FROM reports r
     JOIN users author ON author.id = r.user_id
     WHERE r.user_id <> ? AND author.contribute_reports = 1
       AND r.share_with_community = 1 AND r.community_status = 'visible'
       AND r.status = 'active' AND r.expires_at > UTC_TIMESTAMP(3)
       AND r.public_latitude BETWEEN ? AND ? AND r.public_longitude BETWEEN ? AND ?
     ORDER BY r.created_at DESC LIMIT 250`,
    [
      userId,
      userId,
      center.latitude - latitudeDelta,
      center.latitude + latitudeDelta,
      center.longitude - longitudeDelta,
      center.longitude + longitudeDelta,
    ],
  );
  return rows
    .map((row) => {
      const location = {
        latitude: Number(row.public_latitude),
        longitude: Number(row.public_longitude),
      };
      return {
        id: row.id,
        type: row.type,
        description: row.description,
        location,
        distanceMeters: distanceMeters(center, location),
        createdAt: row.created_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
        hasPhoto: Boolean(row.has_photo),
        confirmationCount: Number(row.confirmation_count ?? 0),
        resolvedCount: Number(row.resolved_count ?? 0),
        notFoundCount: Number(row.not_found_count ?? 0),
        myChoice: row.my_choice ?? null,
      } satisfies CommunityReport;
    })
    .filter((report) => report.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 100);
}

async function requireOtherUserCommunityReport(userId: string, reportId: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.user_id FROM reports r JOIN users author ON author.id = r.user_id
     WHERE r.id = ? AND r.user_id <> ? AND author.contribute_reports = 1
       AND r.share_with_community = 1 AND r.community_status = 'visible'
       AND r.status = 'active' AND r.expires_at > UTC_TIMESTAMP(3)`,
    [reportId, userId],
  );
  if (!rows[0])
    throw new AppError(404, 'COMMUNITY_REPORT_NOT_FOUND', 'Relato não encontrado ou expirado.');
}

export async function setCommunityFeedback(
  userId: string,
  reportId: string,
  choice: FeedbackChoice,
) {
  await requireOtherUserCommunityReport(userId, reportId);
  await pool.execute(
    `INSERT INTO report_feedback (user_id, report_id, choice)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE choice = VALUES(choice), updated_at = UTC_TIMESTAMP(3)`,
    [userId, reportId, choice],
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       SUM(choice = 'present') AS confirmation_count,
       SUM(choice = 'resolved') AS resolved_count,
       SUM(choice = 'not_found') AS not_found_count
     FROM report_feedback WHERE report_id = ?`,
    [reportId],
  );
  return {
    reportId,
    myChoice: choice,
    confirmationCount: Number(rows[0]?.confirmation_count ?? 0),
    resolvedCount: Number(rows[0]?.resolved_count ?? 0),
    notFoundCount: Number(rows[0]?.not_found_count ?? 0),
  };
}

export async function flagCommunityReport(userId: string, reportId: string) {
  await requireOtherUserCommunityReport(userId, reportId);
  await pool.execute('INSERT IGNORE INTO report_flags (user_id, report_id) VALUES (?, ?)', [
    userId,
    reportId,
  ]);
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM report_flags WHERE report_id = ?',
    [reportId],
  );
  const hidden = Number(rows[0]?.total ?? 0) >= 3;
  if (hidden)
    await pool.execute(
      "UPDATE reports SET community_status = 'hidden' WHERE id = ? AND community_status = 'visible'",
      [reportId],
    );
  return { hidden };
}

export async function attachPhoto(
  userId: string,
  reportId: string,
  data: Buffer,
  mimeType: string,
) {
  await getReport(userId, reportId);
  const stored = await saveReportPhoto(data, mimeType);
  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT storage_key FROM report_attachments WHERE report_id = ?',
    [reportId],
  );
  const oldKey = existing[0]?.storage_key as string | undefined;
  try {
    await pool.execute(
      `INSERT INTO report_attachments (id, report_id, storage_key, mime_type, byte_size, created_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE storage_key = VALUES(storage_key), mime_type = VALUES(mime_type),
         byte_size = VALUES(byte_size), created_at = UTC_TIMESTAMP(3)`,
      [randomUUID(), reportId, stored.storageKey, stored.mimeType, stored.byteSize],
    );
  } catch (error) {
    await removeReportPhoto(stored.storageKey);
    throw error;
  }
  if (oldKey) await removeReportPhoto(oldKey);
  return getReport(userId, reportId);
}

export async function communityPhoto(userId: string, reportId: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.storage_key, a.mime_type FROM report_attachments a
     JOIN reports r ON r.id = a.report_id
     JOIN users author ON author.id = r.user_id
     WHERE r.id = ? AND (r.user_id = ? OR (
       author.contribute_reports = 1 AND r.share_with_community = 1
       AND r.community_status = 'visible' AND r.status = 'active'
       AND r.expires_at > UTC_TIMESTAMP(3)
     ))`,
    [reportId, userId],
  );
  const row = rows[0] as
    (RowDataPacket & { storage_key: string; mime_type: ReportPhotoMime }) | undefined;
  if (!row) throw new AppError(404, 'REPORT_PHOTO_NOT_FOUND', 'Foto não encontrada.');
  return { storageKey: row.storage_key, mimeType: row.mime_type };
}

export async function photoStorageKeysForUser(userId: string): Promise<string[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.storage_key FROM report_attachments a JOIN reports r ON r.id = a.report_id
     WHERE r.user_id = ?`,
    [userId],
  );
  return rows.map((row) => String(row.storage_key));
}

export async function photoStorageKeysForExpiredReports(cutoffDate: Date): Promise<string[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT a.storage_key FROM report_attachments a JOIN reports r ON r.id = a.report_id WHERE r.expires_at < ?',
    [cutoffDate],
  );
  return rows.map((row) => String(row.storage_key));
}

export async function photoStorageKeysForExpiredHistory(userId?: string): Promise<string[]> {
  const ownerFilter = userId ? 'r.user_id = ? AND ' : '';
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.storage_key FROM report_attachments a
     JOIN reports r ON r.id = a.report_id
     JOIN users u ON u.id = r.user_id
     WHERE ${ownerFilter}r.expires_at < UTC_TIMESTAMP(3)
       AND r.created_at < TIMESTAMPADD(DAY, -u.retention_days, UTC_TIMESTAMP(3))`,
    userId ? [userId] : [],
  );
  return rows.map((row) => String(row.storage_key));
}
