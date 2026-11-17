import { z } from 'zod';

const PLACEHOLDER_MARKER = 'replace-with';
const booleanText = z.enum(['true', 'false']);

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4010),
  HOST: z.string().default('127.0.0.1'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3307),
  DB_NAME: z.string().regex(/^[a-zA-Z0-9_]+$/),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  WEB_ORIGINS: z.string().default('http://localhost:8081'),
  PUBLIC_WEB_URL: z.url().default('http://localhost:8081'),
  /** Endereço do painel da Prefeitura, usado nos links de redefinição de senha dos operadores. */
  ADMIN_PANEL_URL: z.url().default('http://localhost:5190'),
  DEMO_MODE: booleanText.default('false'),
  ALERT_WORKER_ENABLED: booleanText.default('false'),
  SAFEWALK_SMTP_HOST: z.string().trim().default(''),
  SAFEWALK_SMTP_PORT: z.coerce.number().int().positive().max(65535).default(465),
  SAFEWALK_SMTP_USER: z.string().default(''),
  SAFEWALK_SMTP_PASSWORD: z.string().default(''),
  SAFEWALK_SMTP_FROM: z.string().trim().default(''),
  SAFEWALK_SMTP_SECURE: booleanText.default('false'),
  /** Só para desenvolvimento: aceita enviar e-mail com link http de localhost. Proibido em produção. */
  SAFEWALK_SMTP_ALLOW_LOCAL_LINKS: booleanText.default('false'),
  SAFEWALK_REPORT_PHOTO_DIR: z.string().trim().default(''),
  PHOTON_BASE_URL: z.string().trim().default(''),
  VALHALLA_BASE_URL: z.string().trim().default(''),
  GEOGRAPHIC_SERVICES_ENABLED: booleanText.default('true'),
  ALLOW_COMMUNITY_GEO_SERVICES: booleanText.default('false'),
});

const schema = baseSchema.superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;
  const reject = (path: keyof z.infer<typeof baseSchema>, message: string): void => {
    context.addIssue({ code: 'custom', path: [path], message });
  };
  if (value.JWT_SECRET.includes(PLACEHOLDER_MARKER))
    reject('JWT_SECRET', 'Em produção, JWT_SECRET não pode ser o valor de exemplo.');
  if (value.DB_PASSWORD.includes(PLACEHOLDER_MARKER))
    reject('DB_PASSWORD', 'Em produção, DB_PASSWORD não pode ser o valor de exemplo.');
  if (value.DEMO_MODE === 'true') reject('DEMO_MODE', 'Em produção, DEMO_MODE deve ser false.');
  if (value.SAFEWALK_SMTP_ALLOW_LOCAL_LINKS === 'true')
    reject(
      'SAFEWALK_SMTP_ALLOW_LOCAL_LINKS',
      'Em produção, SAFEWALK_SMTP_ALLOW_LOCAL_LINKS deve ser false: e-mails só levam links https.',
    );
  if (value.ALERT_WORKER_ENABLED !== 'true')
    reject(
      'ALERT_WORKER_ENABLED',
      'Em produção, ALERT_WORKER_ENABLED deve ser true; sem o processador o SOS não escala.',
    );
});

export type Env = z.infer<typeof schema>;

/** Valida variáveis de ambiente de uma fonte explícita, sem depender de process.env. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return schema.parse(source);
}
