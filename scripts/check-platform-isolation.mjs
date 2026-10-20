import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function topLevelBlock(source, key) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}:\\s*(?:#.*)?$`).test(line));
  if (start < 0) return null;
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\S/.test(lines[index]) && lines[index].trim() && !lines[index].trim().startsWith('#')) break;
    body.push(lines[index]);
  }
  return body;
}

function parseServices(compose) {
  const lines = topLevelBlock(compose, 'services');
  if (!lines) return null;
  const services = new Map();
  let current;
  for (const line of lines) {
    const heading = /^ {2}([\w-]+):\s*(?:#.*)?$/.exec(line);
    if (heading) {
      current = heading[1];
      services.set(current, []);
    } else if (current) {
      services.get(current).push(line);
    }
  }
  return services;
}

function property(lines, key) {
  const pattern = new RegExp(`^ {4}(?:${key}|['"]${key}['"]):\\s*(.*)$`);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) return null;
  const inline = pattern.exec(lines[index])[1].trim();
  const body = [];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (/^ {4}\S/.test(lines[cursor])) break;
    body.push(lines[cursor]);
  }
  return { inline, body };
}

function unquote(value) {
  return value.trim().replace(/^(?:"([^"]*)"|'([^']*)')$/, (_match, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
}

function listValues(value) {
  const text = value.trim();
  const content = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
  return content.split(',').map(unquote).filter(Boolean);
}

function networkNames(networks) {
  if (!networks) return [];
  if (networks.inline) return listValues(networks.inline);
  const names = [];
  for (const line of networks.body) {
    const item = /^\s*-\s*([\w-]+)/.exec(line);
    const mapping = /^\s{6}([\w-]+):/.exec(line);
    if (item) names.push(item[1]);
    else if (mapping) names.push(mapping[1]);
  }
  return names;
}

function portEntries(ports) {
  if (!ports) return [];
  const entries = [];
  if (ports.inline) {
    const values = ports.inline.startsWith('[')
      ? [...ports.inline.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1])
      : [unquote(ports.inline)];
    for (const binding of values.filter(Boolean)) entries.push({ kind: 'short', binding });
  }
  for (let index = 0; index < ports.body.length; index += 1) {
    const line = ports.body[index];
    const item = /^\s*-\s*(.*)$/.exec(line);
    if (!item) continue;
    if (/^target\s*:/.test(item[1])) {
      const group = [item[1]];
      for (let cursor = index + 1; cursor < ports.body.length && !/^\s*-\s*/.test(ports.body[cursor]); cursor += 1) {
        group.push(ports.body[cursor].trim());
      }
      const hostIp = group.map((part) => /^host_ip\s*:\s*(.+)$/.exec(part)?.[1]).find(Boolean);
      entries.push({ kind: 'long', hostIp: hostIp ? unquote(hostIp) : '' });
    } else if (item[1]) {
      entries.push({ kind: 'short', binding: unquote(item[1]) });
    }
  }
  return entries;
}

function responseCallsHaveNoStore(source, label, errors) {
  const calls = [...source.matchAll(/Response\.json\([\s\S]*?\);/g)].map((match) => match[0]);
  if (!calls.length) {
    errors.push(`${label}: no response headers could be checked`);
    return;
  }
  const validNoStoreDefinition = /const\s+noStore\s*=\s*\{\s*['"]cache-control['"]\s*:\s*['"]no-store['"]\s*\}/i.test(source);
  for (let index = 0; index < calls.length; index += 1) {
    const call = calls[index];
    const inline = /headers\s*:\s*\{[^}]*['"]cache-control['"]\s*:\s*['"]no-store['"]/i.test(call);
    const shared = /headers\s*:\s*noStore\b/.test(call) && validNoStoreDefinition;
    if (!inline && !shared) errors.push(`${label}: private response ${index + 1} must set Cache-Control: no-store`);
  }
}

export function validatePlatformIsolation({ compose, dockerignore, envExample, smokePostRoute, smokeGetRoute, smokeRetryRoute, smokeSubmitHandler, smokeRetryHandler }) {
  const errors = [];
  const services = parseServices(compose);
  if (!services) errors.push('compose.yaml: missing services section');
  else {
    for (const service of ['db', 'web', 'worker']) {
      if (!services.has(service)) errors.push(`compose.yaml: missing ${service} service`);
    }
    const privateNetworks = topLevelBlock(compose, 'networks') ?? [];
    if (!privateNetworks.some((line) => /^ {2}private:\s*(?:\{\})?\s*(?:#.*)?$/.test(line))) {
      errors.push('compose.yaml: declare the private network');
    }
    for (const service of ['db', 'web', 'worker']) {
      const lines = services.get(service);
      if (!lines) continue;
      const networks = networkNames(property(lines, 'networks'));
      if (!networks.includes('private')) errors.push(`compose.yaml: ${service} must join the private network`);
      if (networks.some((network) => network !== 'private')) errors.push(`compose.yaml: ${service} must not join another network`);
      if (property(lines, 'network_mode')) errors.push(`compose.yaml: ${service} must not override its private network`);
      const ports = property(lines, 'ports');
      if (service !== 'web' && ports) errors.push(`compose.yaml: ${service} must not publish a host port`);
      if (service === 'web') {
        const entries = portEntries(ports);
        if (!entries.length) errors.push('compose.yaml: web must publish its local smoke port on loopback');
        if (entries.some((entry) => entry.kind === 'short'
          ? !entry.binding.startsWith('127.0.0.1:')
          : entry.hostIp !== '127.0.0.1')) {
          errors.push('compose.yaml: every web host port must bind to 127.0.0.1');
        }
      }
    }
  }

  const ignoreRules = dockerignore.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const positiveRules = ignoreRules.filter((line) => !line.startsWith('!'));
  const coversEnv = positiveRules.includes('**/.env*');
  if (!coversEnv || ignoreRules.some((line) => line.startsWith('!') && /\.env/i.test(line))) {
    errors.push('.dockerignore: exclude .env files and variants from the build context');
  }

  const envEntries = envExample.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const envKeys = envEntries.map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line));
  const requiredEnvKeys = ['POSTGRES_PASSWORD', 'STAGING_SMOKE_SECRET'];
  if (envKeys.some((match) => !match)
    || envKeys.some((match) => match?.[2] !== '')
    || envKeys.map((match) => match?.[1]).sort().join(',') !== [...requiredEnvKeys].sort().join(',')) {
    errors.push('.env.example: list only empty POSTGRES_PASSWORD and STAGING_SMOKE_SECRET placeholders');
  }

  for (const [label, source] of [
    ['POST /api/internal/smoke', smokePostRoute],
    ['GET /api/internal/smoke/{id}', smokeGetRoute],
    ['POST /api/internal/smoke/{id}/retry', smokeRetryRoute],
  ]) {
    if (!/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(source)) {
      errors.push(`${label}: route must be force-dynamic`);
    }
  }
  if (!/handleSmokeSubmitRequest\s*\(/.test(smokePostRoute)) {
    errors.push('POST /api/internal/smoke: use the checked no-store request handler');
  }
  responseCallsHaveNoStore(smokeSubmitHandler, 'POST /api/internal/smoke', errors);
  responseCallsHaveNoStore(smokeGetRoute, 'GET /api/internal/smoke/{id}', errors);
  if (!/handleSmokeRetryRequest\s*\(/.test(smokeRetryRoute)) {
    errors.push('POST /api/internal/smoke/{id}/retry: use the checked no-store request handler');
  }
  responseCallsHaveNoStore(smokeRetryHandler, 'POST /api/internal/smoke/{id}/retry', errors);

  return errors;
}

function read(root, path) {
  return readFileSync(join(root, path), 'utf8');
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const errors = validatePlatformIsolation({
      compose: read(root, 'compose.yaml'),
      dockerignore: read(root, '.dockerignore'),
      envExample: read(root, '.env.example'),
      smokePostRoute: read(root, 'src/app/api/internal/smoke/route.ts'),
      smokeGetRoute: read(root, 'src/app/api/internal/smoke/[id]/route.ts'),
      smokeRetryRoute: read(root, 'src/app/api/internal/smoke/[id]/retry/route.ts'),
      smokeSubmitHandler: read(root, 'src/adapters/http/smoke-submit-handler.ts'),
      smokeRetryHandler: read(root, 'src/adapters/http/smoke-retry-handler.ts'),
    });
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
      return;
    }
    console.log('Platform isolation OK: local ports, private network, build secrets, and private route cache policy.');
  } catch {
    console.error('Platform isolation check could not read the required repository configuration.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
