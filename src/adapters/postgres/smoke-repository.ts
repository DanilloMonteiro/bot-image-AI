import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PgBoss } from 'pg-boss';
import type { SmokeRepository, SmokeTask } from '../../modules/platform-smoke/repository.js';

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
  boss ??= new PgBoss(databaseUrl());
  return boss;
}

export function ensureReady(): Promise<void> {
  ready ??= (async () => {
    await getBoss().start();
    await getPool().query(`CREATE TABLE IF NOT EXISTS platform_smoke_tasks (
      id uuid PRIMARY KEY,
      state text NOT NULL CHECK (state IN ('queued', 'processing', 'completed', 'failed')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      error_code text
    )`);
    await getBoss().createQueue(SMOKE_QUEUE, { retryLimit: 2, retryDelay: 1, expireInSeconds: 30 });
  })().catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
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
        id, retryLimit: 2, retryDelay: 1, expireInSeconds: 30,
        db: { executeSql: (text, values) => client.query(text, values) },
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
      const job = await getBoss().getJobById(SMOKE_QUEUE, id);
      if (job?.state === 'failed') {
        const failed = await getPool().query(
          "UPDATE platform_smoke_tasks SET state = 'failed', error_code = 'retries_exhausted', updated_at = now() WHERE id = $1 AND state NOT IN ('completed', 'failed') RETURNING *",
          [id],
        );
        if (failed.rows[0]) return toTask(failed.rows[0]);
      }
    }
    return toTask(result.rows[0]);
  }

  async markProcessing(id: string): Promise<void> {
    await getPool().query("UPDATE platform_smoke_tasks SET state = 'processing', updated_at = now() WHERE id = $1 AND state IN ('queued', 'processing')", [id]);
  }
  async markCompleted(id: string): Promise<void> {
    await getPool().query("UPDATE platform_smoke_tasks SET state = 'completed', error_code = NULL, updated_at = now() WHERE id = $1", [id]);
  }
  async markFailed(id: string, errorCode: string): Promise<void> {
    await getPool().query("UPDATE platform_smoke_tasks SET state = 'failed', error_code = $2, updated_at = now() WHERE id = $1", [id, errorCode]);
  }
}
