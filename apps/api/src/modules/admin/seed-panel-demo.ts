import { crc32, deflateSync } from 'node:zlib';
import { env } from '../../config/env.js';
import { pool } from '../../database/pool.js';

/**
 * Popula o painel com relatos de EXEMPLO para demonstração (descrições começam com "[Exemplo]").
 * Só roda com DEMO_MODE=true fora de produção e precisa da API local no ar. Uso:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:seed -w @safewalk/api
 */
const origin = process.env.SAFEWALK_SEED_API_URL ?? 'http://127.0.0.1:4010';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

type Seed = {
  type: string;
  address: string;
  description: string;
  latitude: number;
  longitude: number;
  /** Quantos dias atrás chegou. */
  daysAgo: number;
  /** Estados por que o caso passou, em ordem; vazio = continua "recebido". */
  steps?: { status: string; note: string; afterHours: number }[];
  photo?: boolean;
};

const seeds: Seed[] = [
  {
    type: 'pothole',
    address: 'Av. Paulista, 1578 · Bela Vista',
    description: '[Exemplo] Buraco fundo na faixa da direita, carros desviam para a ciclofaixa.',
    latitude: -23.5614,
    longitude: -46.6559,
    daysAgo: 9,
    photo: true,
    steps: [{ status: 'analyzing', note: 'Vistoria agendada.', afterHours: 20 }],
  },
  {
    type: 'pothole',
    address: 'Av. Paulista, 1600 · Bela Vista',
    description: '[Exemplo] Mesmo buraco, já pegou o pneu de uma moto.',
    latitude: -23.5619,
    longitude: -46.6563,
    daysAgo: 4,
  },
  {
    type: 'pothole',
    address: 'Av. Paulista, 1560 · Bela Vista',
    description: '[Exemplo] Piorou depois da chuva de ontem.',
    latitude: -23.5611,
    longitude: -46.6556,
    daysAgo: 1,
  },
  {
    type: 'traffic_light',
    address: 'Rua da Consolação x Rua Augusta · Consolação',
    description: '[Exemplo] Semáforo de pedestres apagado, atravessar aqui é arriscado.',
    latitude: -23.5538,
    longitude: -46.6613,
    daysAgo: 2,
  },
  {
    type: 'traffic_light',
    address: 'Rua da Consolação, 2100 · Consolação',
    description: '[Exemplo] Luz vermelha não acende para os carros.',
    latitude: -23.5541,
    longitude: -46.6618,
    daysAgo: 0,
  },
  {
    type: 'traffic_light',
    address: 'Av. Brigadeiro Luís Antônio, 1000 · Bela Vista',
    description: '[Exemplo] Semáforo piscando em amarelo há dois dias.',
    latitude: -23.5701,
    longitude: -46.6485,
    daysAgo: 3,
    steps: [
      { status: 'analyzing', note: 'Equipe de sinalização avisada.', afterHours: 5 },
      { status: 'dispatched', note: 'Técnico a caminho.', afterHours: 30 },
    ],
  },
  {
    type: 'pothole',
    address: 'Rua Vergueiro, 1500 · Liberdade',
    description: '[Exemplo] Cratera junto ao ponto de ônibus.',
    latitude: -23.5732,
    longitude: -46.6381,
    daysAgo: 6,
    steps: [
      { status: 'dispatched', note: 'Operação tapa-buraco programada.', afterHours: 48 },
      { status: 'resolved', note: 'Buraco tapado.', afterHours: 120 },
    ],
  },
  {
    type: 'lighting',
    address: 'Rua da Liberdade, 400 · Liberdade',
    description: '[Exemplo] Quarteirão inteiro sem iluminação à noite.',
    latitude: -23.5587,
    longitude: -46.6355,
    daysAgo: 8,
  },
  {
    type: 'sidewalk',
    address: 'Rua Treze de Maio, 200 · Bela Vista',
    description: '[Exemplo] Calçada quebrada, cadeirante não passa.',
    latitude: -23.5602,
    longitude: -46.6492,
    daysAgo: 5,
  },
  {
    type: 'flood',
    address: 'Av. 23 de Maio, altura do Viaduto · Paraíso',
    description: '[Exemplo] Água acumulada na faixa da direita depois da chuva.',
    latitude: -23.5742,
    longitude: -46.6541,
    daysAgo: 0,
  },
  {
    type: 'construction',
    address: 'Rua Frei Caneca, 569 · Consolação',
    description: '[Exemplo] Obra ocupa a calçada inteira, sem passagem protegida.',
    latitude: -23.5547,
    longitude: -46.6528,
    daysAgo: 7,
    steps: [
      {
        status: 'dismissed',
        note: 'Obra com alvará válido e passagem provisória liberada.',
        afterHours: 40,
      },
    ],
  },
  {
    type: 'obstruction',
    address: 'Rua Pamplona, 700 · Jardim Paulista',
    description: '[Exemplo] Caçamba bloqueia a rampa de acessibilidade.',
    latitude: -23.5668,
    longitude: -46.6522,
    daysAgo: 2,
  },
  {
    type: 'pothole',
    address: 'Rua Augusta, 1300 · Consolação',
    description: '[Exemplo] Asfalto afundando perto do cruzamento.',
    latitude: -23.5559,
    longitude: -46.6577,
    daysAgo: 11,
    steps: [{ status: 'analyzing', note: 'Em fila de vistoria.', afterHours: 70 }],
  },
  {
    type: 'traffic_light',
    address: 'Rua Vergueiro x Rua Tamandaré · Liberdade',
    description: '[Exemplo] Botoeira de pedestres não funciona.',
    latitude: -23.5689,
    longitude: -46.6366,
    daysAgo: 10,
    steps: [{ status: 'resolved', note: 'Botoeira trocada.', afterHours: 52 }],
  },
];

async function call(path: string, init: RequestInit & { token?: string } = {}): Promise<unknown> {
  const { token, ...rest } = init;
  const response = await fetch(`${origin}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
  return Buffer.concat([head, data, tail]);
}

/** PNG RGB de 8 bits; `scanlines` já traz o byte de filtro (0) no começo de cada linha. */
function encodePng(width: number, height: number, scanlines: Buffer): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Ilustração sintética (pista com um buraco escuro), não uma foto real. */
function illustrativePhoto(): string {
  const width = 360;
  const height = 220;
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    rows.push(0);
    for (let x = 0; x < width; x++) {
      const road = y > 90;
      const hole = (x - 190) ** 2 / 3600 + (y - 150) ** 2 / 700 < 1;
      const [r, g, b] = hole ? [38, 36, 34] : road ? [92, 94, 98] : [176, 200, 224];
      rows.push(r, g, b);
    }
  }
  return encodePng(width, height, Buffer.from(rows)).toString('base64');
}

try {
  if (env.NODE_ENV === 'production' || env.DEMO_MODE !== 'true')
    throw new Error('O seed de exemplo só roda com DEMO_MODE=true fora de produção.');
  if (!email || !password) throw new Error('Informe ADMIN_EMAIL e ADMIN_PASSWORD (operador).');
  const login = (await call('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })) as { token: string };
  const citizens = await Promise.all(
    Array.from(
      { length: 4 },
      () => call('/api/auth/demo', { method: 'POST' }) as Promise<{ token: string }>,
    ),
  );
  const now = Date.now();
  let created = 0;
  for (const [index, seed] of seeds.entries()) {
    const citizen = citizens[index % citizens.length];
    if (!citizen) continue;
    const report = (await call('/api/reports', {
      method: 'POST',
      token: citizen.token,
      body: JSON.stringify({
        type: seed.type,
        description: seed.description,
        address: seed.address,
        location: { latitude: seed.latitude, longitude: seed.longitude },
        shareWithGovernment: true,
      }),
    })) as { id: string };
    if (seed.photo) {
      const upload = await fetch(`${origin}/api/reports/${report.id}/photo`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${citizen.token}`,
          'Content-Type': 'application/vnd.safewalk.image+base64',
          'X-Photo-Mime-Type': 'image/png',
        },
        body: illustrativePhoto(),
      });
      if (!upload.ok) throw new Error(`foto: ${upload.status}`);
    }
    for (const step of seed.steps ?? [])
      await call(`/api/admin/reports/${report.id}/status`, {
        method: 'PATCH',
        token: login.token,
        body: JSON.stringify({ status: step.status, note: step.note }),
      });
    // Recua as datas para a fila e os gráficos parecerem de alguns dias de uso.
    const createdAt = new Date(now - seed.daysAgo * 86_400_000 - index * 3_600_000);
    await pool.execute('UPDATE reports SET created_at = ?, gov_updated_at = ? WHERE id = ?', [
      createdAt,
      createdAt,
      report.id,
    ]);
    await pool.execute(
      'UPDATE report_admin_events SET created_at = ? WHERE report_id = ? AND from_status IS NULL',
      [createdAt, report.id],
    );
    let moment = createdAt.getTime();
    const [events] = await pool.execute<import('mysql2').RowDataPacket[]>(
      'SELECT id FROM report_admin_events WHERE report_id = ? AND from_status IS NOT NULL ORDER BY id',
      [report.id],
    );
    let last = createdAt;
    for (const [position, step] of (seed.steps ?? []).entries()) {
      moment += step.afterHours * 3_600_000;
      last = new Date(Math.min(moment, now - 60_000));
      await pool.execute('UPDATE report_admin_events SET created_at = ? WHERE id = ?', [
        last,
        events[position]?.id,
      ]);
    }
    if ((seed.steps ?? []).length > 0)
      await pool.execute('UPDATE reports SET gov_updated_at = ? WHERE id = ?', [last, report.id]);
    created++;
  }
  console.info(`${created} relatos de exemplo criados no painel.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Não foi possível criar os exemplos.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
