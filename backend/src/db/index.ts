import { Client, Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { currentUserId } from '../utils/request-context';

// Application pool. In production this MUST connect as a least-privilege role
// (not a superuser, not the table owner) so PostgreSQL Row-Level Security applies.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err: err.message }, 'Unexpected error on idle PostgreSQL pool client');
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_LOCK_ID = 727_001; // arbitrary constant for pg_advisory_lock

function listMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    // Fail loudly: a build that forgot to ship the SQL files must not start silently without a schema.
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();
}

/**
 * Versioned, idempotent migration runner.
 *
 * - Connects with MIGRATION_DATABASE_URL (schema owner) when set, else DATABASE_URL.
 * - Serialises concurrent runners (API + worker starting together) with an advisory lock.
 * - Applies each pending file in its own transaction and records it in schema_migrations.
 * - Never re-applies an applied file; warns if an applied file's checksum changed.
 */
export async function runMigrations(): Promise<string[]> {
  const client = new Client({ connectionString: config.migrationDatabaseUrl || config.databaseUrl });
  await client.connect();
  const applied: string[] = [];

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        checksum   VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    const done = new Map<string, string>(
      (await client.query('SELECT filename, checksum FROM schema_migrations')).rows.map((r) => [r.filename, r.checksum])
    );

    for (const file of listMigrationFiles()) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      if (done.has(file)) {
        if (done.get(file) !== checksum) {
          logger.warn({ file }, 'Applied migration has been modified since it ran; create a new migration instead');
        }
        continue;
      }

      logger.info({ file }, 'Applying database migration');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }

    logger.info({ applied: applied.length }, 'Database migrations up to date');
    return applied;
  } catch (error) {
    logger.error({ err: (error as Error).message }, 'Failed to run database migrations');
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    await client.end();
  }
}

// Executes a database query inside a client transaction with RLS organization_id & user_id context set
export async function withTenantContext<T>(
  organizationId: string | null,
  callback: (client: PoolClient) => Promise<T>,
  userId: string | null = null
): Promise<T> {
  const client = await pool.connect();
  // Fall back to the authenticated user of the current request (used for audit attribution).
  const actingUserId = userId ?? currentUserId();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId || '']);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actingUserId || '']);

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
