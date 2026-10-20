import { rmSync } from 'node:fs';

export async function withCleanup(operation, cleanup) {
  try {
    return await operation();
  } finally {
    await cleanup();
  }
}

export function cleanupRestoreResources(runtimes, tempDirectory, compose) {
  let cleanupFailed = false;
  for (const runtime of runtimes) {
    try {
      compose(runtime, 'down', '--volumes', '--remove-orphans');
    } catch {
      console.error('Could not clean the isolated Compose project ' + runtime.project);
      cleanupFailed = true;
    }
  }
  try {
    rmSync(tempDirectory, { recursive: true, force: true });
  } catch {
    console.error('Could not remove the temporary backup directory');
    cleanupFailed = true;
  }
  return cleanupFailed;
}
