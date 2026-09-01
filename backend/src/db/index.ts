import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL pool client');
});

// Runs schema migrations
export async function runMigrations() {
  const migrations = ['001_initial_schema.sql', '002_agent_schema.sql'];
  const client = await pool.connect();
  try {
    for (const file of migrations) {
      const migrationPath = path.join(__dirname, 'migrations', file);
      if (fs.existsSync(migrationPath)) {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        logger.info({ file }, `Executing database migration: ${file}`);
        await client.query(sql);
      }
    }
    logger.info('Database migrations executed successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to run database migrations');
    throw error;
  } finally {
    client.release();
  }
}

// Executes a database query inside a client transaction with RLS organization_id & user_id context set
export async function withTenantContext<T>(
  organizationId: string | null,
  callback: (client: PoolClient) => Promise<T>,
  userId: string | null = null
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_organization_id', $1, true)`, [organizationId || '']);
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId || '']);

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
