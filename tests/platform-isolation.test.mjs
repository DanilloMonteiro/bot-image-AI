import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlatformIsolation } from '../scripts/check-platform-isolation.mjs';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const read = (path) => readFileSync(join(root, path), 'utf8');
const baseline = {
  compose: read('compose.yaml'),
  dockerignore: read('.dockerignore'),
  envExample: read('.env.example'),
  smokePostRoute: read('src/app/api/internal/smoke/route.ts'),
  smokeGetRoute: read('src/app/api/internal/smoke/[id]/route.ts'),
  smokeRetryRoute: read('src/app/api/internal/smoke/[id]/retry/route.ts'),
  smokeSubmitHandler: read('src/adapters/http/smoke-submit-handler.ts'),
  smokeRetryHandler: read('src/adapters/http/smoke-retry-handler.ts'),
};

test('valid local isolation configuration passes without Docker', () => {
  assert.deepEqual(validatePlatformIsolation(baseline), []);
});

test('database exposure, public web binding, missing env exclusions, and cache gaps fail actionably', async (t) => {
  await t.test('database port', () => {
    const config = { ...baseline, compose: baseline.compose.replace('    networks: [private]', '    ports:\n      - "5432:5432"\n    networks: [private]') };
    assert.match(validatePlatformIsolation(config).join('\n'), /db must not publish a host port/);
  });

  await t.test('quoted database port key', () => {
    const config = { ...baseline, compose: baseline.compose.replace('    networks: [private]', "    'ports': ['5432:5432']\n    networks: [private]") };
    assert.match(validatePlatformIsolation(config).join('\n'), /db must not publish a host port/);
  });

  await t.test('web host binding', () => {
    const config = { ...baseline, compose: baseline.compose.replace('127.0.0.1:3000:3000', '0.0.0.0:3000:3000') };
    assert.match(validatePlatformIsolation(config).join('\n'), /web host port must bind to 127\.0\.0\.1/);
  });

  await t.test('root-only Docker env exclusion', () => {
    const config = {
      ...baseline,
      dockerignore: baseline.dockerignore.replace(/^\*\*\/\.env\*\r?$/m, '.env*'),
    };
    assert.match(validatePlatformIsolation(config).join('\n'), /exclude \.env files and variants/);
  });

  await t.test('private response cache policy', () => {
    const config = { ...baseline, smokeSubmitHandler: baseline.smokeSubmitHandler.replace('headers: noStore', 'status: 401') };
    assert.match(validatePlatformIsolation(config).join('\n'), /POST \/api\/internal\/smoke: private response 1 must set Cache-Control: no-store/);
  });
});

test('Railway graph keeps worker and storage private and production smoke synthetic', () => {
  const graph = read('.railway/railway.ts');
  const proxy = read('src/proxy.ts');
  assert.match(graph, /const database = postgres\('postgres'\);/);
  assert.match(graph, /bucket\('media', \{ region: 'iad' \}\)/);
  assert.match(graph, /healthcheck: '\/health'/);
  assert.match(graph, /PRODUCTION_SMOKE_SECRET: preserve\(\)/);
  assert.match(graph, /DATABASE_URL: database\.env\.DATABASE_URL/);
  assert.doesNotMatch(graph, /domains\s*:/);
  const appServices = graph.slice(graph.indexOf('const web = service('), graph.indexOf('const postgresBackup = service('));
  assert.doesNotMatch(appServices, /BUCKET|AWS_ACCESS_KEY|S3_/);
  const backupService = graph.slice(graph.indexOf('const postgresBackup = service('));
  assert.match(backupService, /AWS_ACCESS_KEY_ID: ref\(postgresBackups, 'ACCESS_KEY_ID'\)/);
  assert.match(backupService, /AWS_SECRET_ACCESS_KEY: ref\(postgresBackups, 'SECRET_ACCESS_KEY'\)/);
  assert.match(proxy, /isPublicStoryPath\(request\.nextUrl\.pathname\)/);
  assert.match(proxy, /matcher: \['\/\(\(\?!_next\/\|favicon\.ico\)\.\*\)'\]/);
  assert.match(read('compose.yaml'), /PLATFORM_ENVIRONMENT: staging/);
});

test('invalid environment examples fail without echoing values', () => {
  const fakeSecret = 'platform-isolation-test-secret-value';
  const errors = validatePlatformIsolation({
    ...baseline,
    envExample: `POSTGRES_PASSWORD=${fakeSecret}\nSTAGING_SMOKE_SECRET=`,
  });
  assert.match(errors.join('\n'), /\.env\.example: list only empty/);
  assert.equal(errors.join('\n').includes(fakeSecret), false);
});

test('unapproved provider controls remain documented gates and CI does not deploy', () => {
  const documentation = read('docs/platform-staging.md');
  const workflow = read('.github/workflows/staging-smoke.yml');
  assert.match(documentation, /staging and production secrets in separate provider scopes/i);
  assert.match(documentation, /webhooks behind HTTPS/i);
  assert.match(documentation, /database on a private network with no public ingress/i);
  assert.match(documentation, /Cache-Control: no-store`? and bypass shared caches/i);
  assert.match(documentation, /Consumer media for E6 must use private storage/i);
  assert.match(documentation, /cannot prove that a live provider/i);
  assert.doesNotMatch(workflow, /\b(deploy|provision)\b/i);
  assert.ok(workflow.indexOf('npm run check:platform-isolation') < workflow.indexOf('npm run smoke:local'));
});
