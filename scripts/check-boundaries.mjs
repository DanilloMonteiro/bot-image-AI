import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

const root = resolve('src');
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

function filesAt(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const file = join(folder, entry.name);
    return entry.isDirectory() ? filesAt(file) : extensions.some((ext) => file.endsWith(ext)) ? [file] : [];
  });
}

function violations(file, source) {
  const path = relative(root, file).split(sep).join('/');
  const ownModule = /^modules\/([^/]+)\//.exec(path)?.[1];
  if (!ownModule) return [];
  const problems = [];
  const imports = /(?:\bfrom\s*|\bimport\s*(?:\(|(?=['"]))|\brequire\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(imports)) {
    const spec = match[1];
    if (spec === 'next' || spec.startsWith('next/') || spec === 'pg' || spec === 'pg-boss') {
      problems.push(`${path}: domain/application cannot import framework or database SDK: ${spec}`);
      continue;
    }
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    const target = spec.startsWith('@/') ? spec.slice(2) : relative(root, resolve(dirname(file), spec)).split(sep).join('/');
    if (target.startsWith('adapters/') || target.startsWith('app/') || target.startsWith('worker/')) {
      problems.push(`${path}: module cannot import infrastructure: ${spec}`);
    }
    const otherModule = /^modules\/([^/]+)\/(.+)/.exec(target);
    if (otherModule && otherModule[1] !== ownModule && !/^use-cases(?:\.js|\.ts)?$/.test(otherModule[2])) {
      problems.push(`${path}: use another module's public use cases only: ${spec}`);
    }
  }
  return problems;
}

const fixture = resolve(root, 'modules/example/use-cases.ts');
if (violations(fixture, "import '../other/private-repository.js'").length !== 1 ||
    violations(fixture, "import '@/adapters/postgres/smoke-repository'").length !== 1 ||
    violations(fixture, "import '../other/use-cases.js'").length !== 0) {
  throw new Error('Boundary self-check failed');
}
const errors = filesAt(root).flatMap((file) => violations(file, readFileSync(file, 'utf8')));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Module boundaries OK; forbidden import fixtures rejected.');
