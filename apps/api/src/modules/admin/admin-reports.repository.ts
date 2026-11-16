import type { RowDataPacket } from 'mysql2';
import {
  openGovernmentStatuses,
  type AdminReportDetail,
  type AdminReportEvent,
  type AdminReportItem,
  type AdminReportList,
  type AdminReportListQuery,
  type AdminSummary,
  type GovernmentStatus,
  type ReportType,
} from '@safewalk/contracts';
import { pool, transaction } from '../../database/pool.js';
import {
  buildHotspots,
  HOTSPOT_LATITUDE_DELTA,
  HOTSPOT_LONGITUDE_DELTA,
} from '../../domain/report-hotspots.js';
import { reportPriority, priorityScore } from '../../domain/report-priority.js';
import { AppError } from '../../middleware/errors.js';
import type { ReportPhotoMime } from '../reports/report-photo-storage.js';

/** Quantos relatos cabem numa resposta: o painel mostra a fila mais urgente primeiro. */
const LIST_LIMIT = 300;
const FETCH_LIMIT = 1000;
/** Janela de "mesmo ponto" (~100 m): a mesma dos pontos críticos, para os números concordarem. */
const NEARBY_LATITUDE_DELTA = HOTSPOT_LATITUDE_DELTA;
const NEARBY_LONGITUDE_DELTA = HOTSPOT_LONGITUDE_DELTA;
const OPEN_STATUSES_SQL = openGovernmentStatuses.map((status) => `'${status}'`).join(', ');
const DAILY_WINDOW_DAYS = 14;
/** São Paulo não tem horário de verão desde 2019: fuso fixo para agrupar por dia. */
const SAO_PAULO_OFFSET = '-03:00';

type ItemRow = RowDataPacket & {
  id: string;
  type: ReportType;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  created_at: Date;
  author_status: 'active' | 'resolved';
  gov_status: GovernmentStatus;
  status_updated_at: Date;
  has_photo: number;
  confirmation_count: number | string;
  nearby_count: number | string;
};

const itemSelect = `SELECT r.id, r.type, r.description, r.address, r.latitude, r.longitude,
  r.created_at, r.status AS author_status, r.gov_status,
  COALESCE(r.gov_updated_at, r.created_at) AS status_updated_at,
  EXISTS(SELECT 1 FROM report_attachments a WHERE a.report_id = r.id) AS has_photo,
  (SELECT COUNT(*) FROM report_feedback f WHERE f.report_id = r.id AND f.choice = 'present') AS confirmation_count,
  (SELECT COUNT(*) FROM reports n
    WHERE n.share_with_government = 1 AND n.type = r.type
      AND n.gov_status IN (${OPEN_STATUSES_SQL})
      AND n.latitude BETWEEN r.latitude - ${NEARBY_LATITUDE_DELTA} AND r.latitude + ${NEARBY_LATITUDE_DELTA}
      AND n.longitude BETWEEN r.longitude - ${NEARBY_LONGITUDE_DELTA} AND r.longitude + ${NEARBY_LONGITUDE_DELTA}
  ) AS nearby_count
  FROM reports r`;

function toItem(row: ItemRow, now: number): AdminReportItem {
  const confirmationCount = Number(row.confirmation_count);
  const nearbyCount = Math.max(1, Number(row.nearby_count));
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    address: row.address,
    location: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    createdAt: row.created_at.toISOString(),
    status: row.gov_status,
    statusUpdatedAt: row.status_updated_at.toISOString(),
    hasPhoto: Boolean(row.has_photo),
    confirmationCount,
    nearbyCount,
    priority: reportPriority({
      type: row.type,
      nearbyCount,
      confirmationCount,
      ageHours: (now - row.created_at.getTime()) / 3_600_000,
    }),
    authorResolved: row.author_status === 'resolved',
  };
}

function filters(query: AdminReportListQuery): { where: string; params: (string | Date)[] } {
  const clauses = ['r.share_with_government = 1'];
  const params: (string | Date)[] = [];
  if (query.status === 'open') clauses.push(`r.gov_status IN (${OPEN_STATUSES_SQL})`);
  else if (query.status !== 'all') {
    clauses.push('r.gov_status = ?');
    params.push(query.status);
  }
  if (query.type) {
    clauses.push('r.type = ?');
    params.push(query.type);
  }
  if (query.q) {
    const like = `%${query.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    clauses.push("(r.address LIKE ? ESCAPE '\\\\' OR r.description LIKE ? ESCAPE '\\\\')");
    params.push(like, like);
  }
  if (query.days) {
    clauses.push('r.created_at >= ?');
    params.push(new Date(Date.now() - query.days * 86_400_000));
  }
  return { where: clauses.join(' AND '), params };
}

/** Fila em aberto: mais urgente primeiro e, entre iguais, o mais antigo. Encerrados: mais recentes. */
function byQueueOrder(a: AdminReportItem, b: AdminReportItem, open: boolean): number {
  if (!open) return Date.parse(b.statusUpdatedAt) - Date.parse(a.statusUpdatedAt);
  const score = (item: AdminReportItem) =>
    priorityScore({
      type: item.type,
      nearbyCount: item.nearbyCount,
      confirmationCount: item.confirmationCount,
      ageHours: (Date.now() - Date.parse(item.createdAt)) / 3_600_000,
    });
  return score(b) - score(a) || Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

/** Até FETCH_LIMIT relatos que atendem ao filtro, já com prioridade e na ordem da fila. */
async function loadItems(query: AdminReportListQuery): Promise<AdminReportItem[]> {
  const { where, params } = filters(query);
  const [rows] = await pool.execute<ItemRow[]>(
    `${itemSelect} WHERE ${where} ORDER BY r.created_at DESC LIMIT ${FETCH_LIMIT}`,
    params,
  );
  const now = Date.now();
  const open = query.status === 'open';
  return rows.map((row) => toItem(row, now)).sort((a, b) => byQueueOrder(a, b, open));
}

export async function listAdminReports(query: AdminReportListQuery): Promise<AdminReportList> {
  const { where, params } = filters(query);
  const [counted] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM reports r WHERE ${where}`,
    params,
  );
  const items = (await loadItems(query)).slice(0, LIST_LIMIT);
  const total = Number(counted[0]?.total ?? items.length);
  return { items, total, truncated: total > items.length };
}

export async function getAdminReport(id: string): Promise<AdminReportDetail> {
  const [rows] = await pool.execute<ItemRow[]>(
    `${itemSelect} WHERE r.share_with_government = 1 AND r.id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new AppError(404, 'REPORT_NOT_FOUND', 'Relato não encontrado.');
  const [events] = await pool.execute<RowDataPacket[]>(
    `SELECT e.id, e.from_status, e.to_status, e.note, e.created_at, a.name AS admin_name
     FROM report_admin_events e LEFT JOIN admin_users a ON a.id = e.admin_id
     WHERE e.report_id = ? ORDER BY e.created_at DESC, e.id DESC`,
    [id],
  );
  return {
    ...toItem(row, Date.now()),
    events: events.map((event): AdminReportEvent => ({
      id: Number(event.id),
      fromStatus: (event.from_status as GovernmentStatus | null) ?? null,
      toStatus: event.to_status as GovernmentStatus,
      note: String(event.note),
      adminName: (event.admin_name as string | null) ?? null,
      createdAt: (event.created_at as Date).toISOString(),
    })),
  };
}

/**
 * Muda o andamento e registra quem fez, de qual para qual estado e a nota, na mesma transação.
 * O registro é a trilha do caso: nunca é apagado pelo painel.
 */
export async function changeReportStatus(
  adminId: string,
  reportId: string,
  status: GovernmentStatus,
  note: string,
): Promise<AdminReportDetail> {
  if (status === 'dismissed' && note.length === 0)
    throw new AppError(400, 'NOTE_REQUIRED', 'Explique por que o relato foi arquivado.');
  await transaction(async (db) => {
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT gov_status FROM reports WHERE id = ? AND share_with_government = 1 FOR UPDATE',
      [reportId],
    );
    const current = rows[0]?.gov_status as GovernmentStatus | undefined;
    if (!current) throw new AppError(404, 'REPORT_NOT_FOUND', 'Relato não encontrado.');
    if (current === status && note.length === 0)
      throw new AppError(409, 'STATUS_UNCHANGED', 'O relato já está nesse andamento.');
    await db.execute(
      'UPDATE reports SET gov_status = ?, gov_updated_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [status, reportId],
    );
    await db.execute(
      `INSERT INTO report_admin_events (report_id, admin_id, from_status, to_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [reportId, adminId, current, status, note],
    );
  });
  return getAdminReport(reportId);
}

export async function adminPhoto(
  reportId: string,
): Promise<{ storageKey: string; mimeType: ReportPhotoMime }> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.storage_key, a.mime_type FROM report_attachments a
     JOIN reports r ON r.id = a.report_id
     WHERE r.id = ? AND r.share_with_government = 1`,
    [reportId],
  );
  const row = rows[0];
  if (!row) throw new AppError(404, 'REPORT_PHOTO_NOT_FOUND', 'Foto não encontrada.');
  return { storageKey: String(row.storage_key), mimeType: row.mime_type as ReportPhotoMime };
}

function saoPauloDay(date: Date): string {
  return new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export async function adminSummary(): Promise<AdminSummary> {
  const now = new Date();
  const [byStatus] = await pool.execute<RowDataPacket[]>(
    'SELECT gov_status, COUNT(*) AS total FROM reports WHERE share_with_government = 1 GROUP BY gov_status',
  );
  const total = (status: GovernmentStatus) =>
    Number(byStatus.find((row) => row.gov_status === status)?.total ?? 0);
  const [recent] = await pool.execute<RowDataPacket[]>(
    `SELECT
       SUM(created_at >= TIMESTAMPADD(HOUR, -24, UTC_TIMESTAMP(3))) AS received_24h,
       SUM(gov_status = 'resolved' AND gov_updated_at >= TIMESTAMPADD(DAY, -7, UTC_TIMESTAMP(3))) AS resolved_7d,
       AVG(CASE WHEN gov_status = 'resolved' AND gov_updated_at IS NOT NULL
                THEN TIMESTAMPDIFF(MINUTE, created_at, gov_updated_at) END) AS resolution_minutes
     FROM reports WHERE share_with_government = 1`,
  );
  const [openTypes] = await pool.execute<RowDataPacket[]>(
    `SELECT type, COUNT(*) AS total FROM reports
     WHERE share_with_government = 1 AND gov_status IN (${OPEN_STATUSES_SQL})
     GROUP BY type ORDER BY total DESC, type`,
  );
  const [received] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '${SAO_PAULO_OFFSET}'), '%Y-%m-%d') AS day,
            COUNT(*) AS total
     FROM reports WHERE share_with_government = 1
       AND created_at >= TIMESTAMPADD(DAY, -${DAILY_WINDOW_DAYS + 1}, UTC_TIMESTAMP(3))
     GROUP BY day`,
  );
  const [resolved] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(CONVERT_TZ(gov_updated_at, '+00:00', '${SAO_PAULO_OFFSET}'), '%Y-%m-%d') AS day,
            COUNT(*) AS total
     FROM reports WHERE share_with_government = 1 AND gov_status = 'resolved'
       AND gov_updated_at >= TIMESTAMPADD(DAY, -${DAILY_WINDOW_DAYS + 1}, UTC_TIMESTAMP(3))
     GROUP BY day`,
  );
  const openItems = await loadItems({ status: 'open' });
  const dayTotals = (rows: RowDataPacket[], day: string) =>
    Number(rows.find((row) => row.day === day)?.total ?? 0);
  const daily = Array.from({ length: DAILY_WINDOW_DAYS }, (_, index) => {
    const date = saoPauloDay(
      new Date(now.getTime() - (DAILY_WINDOW_DAYS - 1 - index) * 86_400_000),
    );
    return { date, received: dayTotals(received, date), resolved: dayTotals(resolved, date) };
  });
  const minutes = recent[0]?.resolution_minutes;
  const receivedTotal = total('received');
  const analyzing = total('analyzing');
  const dispatched = total('dispatched');
  return {
    generatedAt: now.toISOString(),
    counts: {
      open: receivedTotal + analyzing + dispatched,
      received: receivedTotal,
      analyzing,
      dispatched,
      resolved: total('resolved'),
      dismissed: total('dismissed'),
      receivedLast24h: Number(recent[0]?.received_24h ?? 0),
      resolvedLast7d: Number(recent[0]?.resolved_7d ?? 0),
      highPriorityOpen: openItems.filter((item) => item.priority === 'high').length,
    },
    averageResolutionHours:
      minutes === null || minutes === undefined
        ? null
        : Math.round((Number(minutes) / 60) * 10) / 10,
    openByType: openTypes.map((row) => ({
      type: row.type as ReportType,
      count: Number(row.total),
    })),
    daily,
    hotspots: buildHotspots(openItems),
  };
}
