// CLI entry point: `npm run migrate` (production) or `npm run migrate:dev`.
// Applies pending migrations with MIGRATION_DATABASE_URL (falls back to DATABASE_URL) and exits.
import { runMigrations, pool } from './index';
import { logger } from '../utils/logger';

runMigrations()
  .then(async (applied) => {
    logger.info({ applied }, applied.length ? 'Migrations applied' : 'No pending migrations');
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err: err.message }, 'Migration failed');
    await pool.end().catch(() => {});
    process.exit(1);
  });
