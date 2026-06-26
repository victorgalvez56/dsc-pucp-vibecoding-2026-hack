import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,                     // 1 por función serverless → PgBouncer maneja el pool real
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function queryWithTimeout<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] | undefined,
  timeoutMs: number,
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    await client.query(`SET statement_timeout = ${timeoutMs}`);
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * Ejecuta SQL generado por el Agente IA en una transacción READ ONLY con timeout.
 * Doble candado: aunque la validación de texto fallara, Postgres rechaza cualquier
 * escritura dentro de `BEGIN TRANSACTION READ ONLY`. Siempre hace ROLLBACK.
 */
export async function queryReadOnly<T = Record<string, unknown>>(
  sql: string,
  timeoutMs = 8_000,
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    const result = await client.query(sql);
    await client.query('ROLLBACK');
    return result.rows as T[];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
