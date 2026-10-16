import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { PgBoss, type ConnectionOptions } from 'pg-boss';
import type { SmokeRepository, SmokeRetryResult, SmokeTask } from '../../modules/platform-smoke/repository.js';

export const SMOKE_QUEUE = 'platform-smoke';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  return url;
}

let pool: Pool | undefined;
let boss: PgBoss | undefined;
let ready: Promise<void> | undefined;

function getPool(): Pool {
  pool ??= new Pool({ connectionString: databaseUrl(), connectionTimeoutMillis: 3000 });
  return pool;
}

export function getBoss(): PgBoss {
  if (!boss) {
    boss = process.env.STAGING_SMOKE_TEST_MODE === '1'
      ? new PgBoss({
        connectionString: databaseUrl(),
        monitorIntervalSeconds: 1,
        superviseIntervalSeconds: 1,
      })
      : new PgBoss(databaseUrl());
  }
  return boss;
}

export function ensureReady(): Promise<void> {
  ready ??= (async () => {
    await getBoss().start();
    await getPool().query(`CREATE TABLE IF NOT EXISTS platform_smoke_tasks (
      id uuid PRIMARY KEY,
      state text NOT NULL CHECK (state IN ('queued', 'processing', 'completed', 'failed')),
      attempt_number integer NOT NULL DEFAULT -1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      error_code text
    )`);
    await getPool().query('ALTER TABLE platform_smoke_tasks ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT -1');
    await getPool().query(`CREATE TABLE IF NOT EXISTS platform_smoke_effects (
      id uuid PRIMARY KEY REFERENCES platform_smoke_tasks(id) ON DELETE CASCADE,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const testMode = process.env.STAGING_SMOKE_TEST_MODE === '1';
    await getBoss().createQueue(SMOKE_QUEUE, {
      retryLimit: 2, retryDelay: 1, expireInSeconds: testMode ? 2 : 30,
      deleteAfterSeconds: 0,
    });
  })().catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}

function transactionDb(client: PoolClient): NonNullable<ConnectionOptions['db']> {
  return { executeSql: (text, values) => client.query(text, values) };
}

function toTask(row: Record<string, unknown>): SmokeTask {
  return {
    id: String(row.id), state: row.state as SmokeTask['state'],
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    errorCode: row.error_code === null ? null : String(row.error_code),
  };
}

export class PostgresSmokeRepository implements SmokeRepository {
  async create(): Promise<SmokeTask> {
    await ensureReady();
    const client = await getPool().connect();
    const id = randomUUID();
    try {
      await client.query('BEGIN');
      const result = await client.query('INSERT INTO platform_smoke_tasks (id, state) VALUES ($1, $2) RETURNING *', [id, 'queued']);
      const jobId = await getBoss().send(SMOKE_QUEUE, { correlationId: id, kind: 'synthetic' }, {
        id, retryLimit: 2, retryDelay: 1,
        expireInSeconds: process.env.STAGING_SMOKE_TEST_MODE === '1' ? 2 : 30,
        deleteAfterSeconds: 0,
        db: transactionDb(client),
      });
      if (!jobId) throw new Error('Queue refused smoke job');
      await client.query('COMMIT');
      return toTask(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async find(id: string): Promise<SmokeTask | null> {
    await ensureReady();
    const result = await getPool().query('SELECT * FROM platform_smoke_tasks WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    if (result.rows[0].state !== 'completed' && result.rows[0].state !== 'failed') {
      const [job] = await getBoss().findJobs(SMOKE_QUEUE, { id });
      if (job?.state === 'failed') {
        const failed = await getPool().query(
          `UPDATE platform_smoke_tasks
           SET state = 'failed', attempt_number = GREATEST(attempt_number, $2),
               error_code = 'retries_exhausted', updated_at = now()
           WHERE id = $1 AND state IN ('queued', 'processing') AND attempt_number <= $2
           RETURNING *`,
          [id, job.retryCount],
        );
        if (failed.rows[0]) return toTask(failed.rows[0]);
      }
    }
    return toTask(result.rows[0]);
  }

  async markProcessing(id: string, attempt: number): Promise<boolean> {
    await ensureReady();
    const result = await getPool().query(
      `UPDATE platform_smoke_tasks
       SET state = 'processing', attempt_number = $2, error_code = NULL, updated_at = now()
       WHERE id = $1 AND state IN ('queued', 'processing') AND attempt_number <= $2
       RETURNING id`,
      [id, attempt],
    );
    return result.rowCount === 1;
  }

  async complete(id: string, attempt: number): Promise<boolean> {
    await ensureReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        "SELECT state FROM platform_smoke_tasks WHERE id = $1 AND attempt_number = $2 FOR UPDATE",
        [id, attempt],
      );
      if (current.rows[0]?.state !== 'processing') {
        await client.query('COMMIT');
        return false;
      }
      await client.query('INSERT INTO platform_smoke_effects (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);
      const updated = await client.query(
        `UPDATE platform_smoke_tasks
         SET state = 'completed', error_code = NULL, updated_at = now()
         WHERE id = $1 AND attempt_number = $2 AND state = 'processing'
         RETURNING id`,
        [id, attempt],
      );
      await client.query('COMMIT');
      return updated.rowCount === 1;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async markAttemptFailed(id: string, attempt: number): Promise<void> {
    await getPool().query(
      `UPDATE platform_smoke_tasks SET error_code = 'attempt_failed', updated_at = now()
       WHERE id = $1 AND attempt_number = $2 AND state = 'processing'`,
      [id, attempt],
    );
  }

  async retry(id: string): Promise<SmokeRetryResult> {
    await ensureReady();
    const client = await getPool().connect();
    const db = transactionDb(client);
    try {
      await client.query('BEGIN');
      const taskResult = await client.query('SELECT * FROM platform_smoke_tasks WHERE id = $1 FOR UPDATE', [id]);
      const task = taskResult.rows[0];
      if (!task) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      if (task.state !== 'failed') {
        await client.query('ROLLBACK');
        return { status: 'not_failed' };
      }

      const [job] = await getBoss().findJobs(SMOKE_QUEUE, { id, db });
      if (job?.state !== 'failed') {
        await client.query('ROLLBACK');
        return { status: 'not_failed' };
      }
      const retried = await getBoss().retry(SMOKE_QUEUE, id, { db });
      if (!('affected' in retried) || retried.affected !== 1) {
        await client.query('ROLLBACK');
        return { status: 'not_failed' };
      }
      const updated = await client.query(
        `UPDATE platform_smoke_tasks
         SET state = 'queued', attempt_number = GREATEST(attempt_number, $2),
             error_code = NULL, updated_at = now()
         WHERE id = $1 AND state = 'failed' RETURNING *`,
        [id, job.retryCount + 1],
      );
      if (!updated.rows[0]) {
        await client.query('ROLLBACK');
        return { status: 'not_failed' };
      }
      await client.query('COMMIT');
      return { status: 'retried', task: toTask(updated.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
