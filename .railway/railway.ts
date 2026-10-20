import { bucket, defineRailway, github, postgres, preserve, project, service } from 'railway/iac';

const source = github('DanilloMonteiro/bot-image-AI', { branch: 'main' });
const database = postgres('postgres', { region: 'us-east4-eqdc4a' });
const media = bucket('media', { region: 'iad' });

const web = service('web', {
  source,
  start: 'npm run start:web',
  healthcheck: '/api/health',
  replicas: { 'us-east4-eqdc4a': 1 },
  env: {
    DATABASE_URL: database.env.DATABASE_URL,
    PLATFORM_ENVIRONMENT: 'production',
    PRODUCTION_SMOKE_SECRET: preserve(),
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

export default defineRailway(() => project('ensaios-ia-whatsapp-pilot', {
  resources: [database, media, web, worker],
}));
