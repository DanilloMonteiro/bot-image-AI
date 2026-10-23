import { bucket, defineRailway, github, postgres, preserve, project, ref, service } from 'railway/iac';

const source = github('DanilloMonteiro/bot-image-AI', { branch: 'production' });
const backupSource = github('DanilloMonteiro/bot-image-AI', {
  branch: 'production',
  rootDirectory: '/services/postgres-backup',
});
const database = postgres('postgres');
const media = bucket('media', { region: 'iad' });
const postgresBackups = bucket('postgres-backups', { region: 'iad' });

const web = service('web', {
  source,
  start: 'npm run start:web',
  healthcheck: '/api/health',
  replicas: { 'us-east4-eqdc4a': 1 },
  env: {
    DATABASE_URL: database.env.DATABASE_URL,
    PLATFORM_ENVIRONMENT: 'production',
    PRODUCTION_SMOKE_SECRET: preserve(),
    PRODUCTION_BACKUP_RESTORE_VERIFIED: preserve(),
  },
});

const worker = service('worker', {
  source,
  start: 'npm run start:worker',
  healthcheck: '/health',
  replicas: { 'us-east4-eqdc4a': 1 },
  env: {
    DATABASE_URL: database.env.DATABASE_URL,
    PLATFORM_ENVIRONMENT: 'production',
    PORT: '3001',
  },
});

const postgresBackup = service('postgres-backup', {
  source: backupSource,
  build: {
    builder: 'DOCKERFILE',
  },
  start: 'sh /usr/local/bin/backup.sh',
  regions: { iad: 1 },
  deploy: {
    cronSchedule: '0 3 */3 * *',
    restartPolicyType: 'NEVER',
  },
  env: {
    DATABASE_URL: database.env.DATABASE_URL,
    AWS_ACCESS_KEY_ID: ref(postgresBackups, 'ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: ref(postgresBackups, 'SECRET_ACCESS_KEY'),
    AWS_DEFAULT_REGION: ref(postgresBackups, 'REGION'),
    ENDPOINT: ref(postgresBackups, 'ENDPOINT'),
    BUCKET: ref(postgresBackups, 'BUCKET'),
    BACKUP_RETENTION_DAYS: '6',
  },
});

export default defineRailway(() => project('ensaios-ia-whatsapp-pilot', {
  resources: [database, media, postgresBackups, web, worker, postgresBackup],
}));
