import { Pool, type PoolClient } from 'pg';
import { PgBoss, type ConnectionOptions } from 'pg-boss';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;

  const host = process.env.DATABASE_HOST;
  const port = process.env.DATABASE_PORT ?? '5432';
  const name = process.env.DATABASE_NAME;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  if (!host || !name || !user || password === undefined) {
    throw new Error('DATABASE_URL or database connection settings are required');
  }

  const connection = new URL('postgresql://localhost');
  connection.hostname = host;
  connection.port = port;
  connection.pathname = `/${name}`;
  connection.username = user;
  connection.password = password;
  return connection.toString();
}

let pool: Pool | undefined;
let boss: PgBoss | undefined;
let bossStarted: Promise<void> | undefined;

export function getPool(): Pool {
  if (!pool) {
    const nextPool = new Pool({ connectionString: databaseUrl(), connectionTimeoutMillis: 3000 });
    nextPool.on('error', (error: Error) => {
      const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
      console.error('postgres_pool_error', {
        errorName: error.name,
        ...(code ? { errorCode: code } : {}),
      });
    });
    pool = nextPool;
  }
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

export function startBoss(): Promise<void> {
  bossStarted ??= (async () => { await getBoss().start(); })().catch((error: unknown) => {
    bossStarted = undefined;
    throw error;
  });
  return bossStarted;
}

export function transactionDb(client: PoolClient): NonNullable<ConnectionOptions['db']> {
  return { executeSql: (text, values) => client.query(text, values) };
}
