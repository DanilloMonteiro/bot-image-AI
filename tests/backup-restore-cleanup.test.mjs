import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cleanupRestoreResources, withCleanup } from '../scripts/backup-restore-lifecycle.mjs';

test('cleans both Compose projects and the temporary dump after restore failure', async () => {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'imagesystem-restore-test-'));
  const dumpPath = join(tempDirectory, 'synthetic-state.dump');
  writeFileSync(dumpPath, 'synthetic dump');
  const restored = { project: 'restore-test-target' };
  const source = { project: 'restore-test-source' };
  const cleanedProjects = [];

  await assert.rejects(
    withCleanup(
      async () => {
        throw new Error('pg_restore failed');
      },
      () => {
        const cleanupFailed = cleanupRestoreResources(
          [restored, source],
          tempDirectory,
          (runtime, ...args) => cleanedProjects.push([runtime.project, ...args]),
        );
        assert.equal(cleanupFailed, false);
      },
    ),
    /pg_restore failed/,
  );

  assert.deepEqual(cleanedProjects, [
    ['restore-test-target', 'down', '--volumes', '--remove-orphans'],
    ['restore-test-source', 'down', '--volumes', '--remove-orphans'],
  ]);
  assert.equal(existsSync(dumpPath), false);
  assert.equal(existsSync(tempDirectory), false);
});
