import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true } as any);

const env = process.env;
const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : !['false', '0', 'no', 'off'].includes(value.toLowerCase());
const int = (value: string | undefined, fallback: number) => {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const DEV_JWT_SECRET = 'super-secret-jwt-key-change-in-production-min-32-chars';
const DEV_JWT_REFRESH_SECRET = 'super-secret-jwt-refresh-key-change-in-production';

export const config = {
  port: int(env.PORT, 4000),
  nodeEnv: env.NODE_ENV || 'development',
  isProduction: env.NODE_ENV === 'production',
  logLevel: env.LOG_LEVEL || 'info',

  // --- Database ---------------------------------------------------------
  // DATABASE_URL: least-privilege application role (RLS enforced).
  // MIGRATION_DATABASE_URL: schema owner used only to run migrations (superuser or BYPASSRLS).
  databaseUrl: env.DATABASE_URL || 'postgres://app_user:apppassword@localhost:5432/rag_saas_db',
  migrationDatabaseUrl: env.MIGRATION_DATABASE_URL || '',
  runMigrationsOnStart: bool(env.RUN_MIGRATIONS_ON_START, true),
  dbPoolMax: int(env.DB_POOL_MAX, 20),

  redisUrl: env.REDIS_URL || 'redis://localhost:6379',

  // --- Auth -------------------------------------------------------------
  jwtSecret: env.JWT_SECRET || DEV_JWT_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET || DEV_JWT_REFRESH_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',

  // --- HTTP -------------------------------------------------------------
  // Comma-separated list of allowed browser origins. Empty in development = allow all.
  corsOrigins: (env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Number of reverse proxies in front of the API (for correct client IPs in rate limiting).
  trustProxy: int(env.TRUST_PROXY, 0),
  rateLimitEnabled: bool(env.RATE_LIMIT_ENABLED, env.NODE_ENV !== 'test'),
  maxUploadMb: int(env.MAX_UPLOAD_MB, 25),
  storageDir: env.STORAGE_DIR || '',

  // --- AI providers -----------------------------------------------------
  // LLM: Groq is used when GROQ_API_KEY is set; otherwise (and always in tests) the mock LLM is used.
  groqApiKey: env.GROQ_API_KEY || '',
  groqModel: env.GROQ_MODEL || 'openai/gpt-oss-120b',
  llmTimeoutMs: int(env.LLM_TIMEOUT_MS, 60000),

  // Embeddings: 'local' (real semantic model, runs on this machine) or 'mock' (hash-based).
  // Tests always use the mock: deterministic, fast, and ONNX Runtime doesn't run inside Jest's sandbox.
  embeddingProvider: env.NODE_ENV === 'test' ? 'mock' : (env.EMBEDDING_PROVIDER || 'local').toLowerCase(),
  embeddingModel: env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',

  // Run the BullMQ ingestion worker inside the API process (set false when running the worker separately).
  runIngestionWorker: bool(env.RUN_INGESTION_WORKER, true),
};

/**
 * Fail fast on configuration that would be unsafe in production.
 * Called once at startup by the API and the standalone worker.
 */
export function validateConfig(): void {
  if (!config.isProduction) return;
  const problems: string[] = [];

  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required');
  if (!env.JWT_SECRET || config.jwtSecret === DEV_JWT_SECRET || config.jwtSecret.length < 32)
    problems.push('JWT_SECRET must be set to a random value of at least 32 characters');
  if (!env.JWT_REFRESH_SECRET || config.jwtRefreshSecret === DEV_JWT_REFRESH_SECRET || config.jwtRefreshSecret.length < 32)
    problems.push('JWT_REFRESH_SECRET must be set to a random value of at least 32 characters');
  if (config.jwtSecret === config.jwtRefreshSecret) problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  if (config.corsOrigins.length === 0) problems.push('CORS_ORIGINS must list the allowed frontend origin(s)');
  if (!config.groqApiKey) problems.push('GROQ_API_KEY is required (otherwise answers come from the mock LLM)');

  if (problems.length > 0) {
    throw new Error(`Invalid production configuration:\n - ${problems.join('\n - ')}`);
  }
}
