# Disaster Recovery & Production Backup Runbook

## Executive Summary
This runbook provides step-by-step instructions for backup generation, system recovery, point-in-time database restoration, and migration rollback procedures for the Multi-Tenant RAG Chatbot SaaS platform.

---

## 1. PostgreSQL + pgvector Automated Backup Strategy

### Daily Backup Execution
Automated `pg_dump` backup command executed via cron at `00:00 UTC`:

```bash
pg_dump -h localhost -U rag_user -d rag_saas_db -F c -b -v -f /backups/rag_db_$(date +%Y%m%d_%H%M%S).dump
```

### Storage Retention Policy
- Daily dumps retained for 30 days in encrypted cloud storage (S3 / GCS).
- Monthly backups retained for 12 months.

---

## 2. Database Restoration Procedure

### Step 1: Terminate Active Connections
```sql
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'rag_saas_db'
  AND pid <> pg_backend_pid();
```

### Step 2: Restore Database Dump
```bash
pg_restore -h localhost -U rag_user -d rag_saas_db --clean --if-exists -v /backups/rag_db_target.dump
```

### Step 3: Verify Idempotent Migration Integrity
```bash
cd backend && npm run build
node dist/db/index.js
```

---

## 3. Redis Queue & State Recovery

In the event of a Redis outage or crash:
1. BullMQ ingestion jobs recorded as `QUEUED` in PostgreSQL database are re-enqueued automatically upon application restart.
2. Dead-Letter Queue (`ingestion-dlq`) inspects failed payloads without data loss.

---

## 4. Migration Rollback Protocol

If a schema migration fails during deployment:
1. Revert to the last known database backup.
2. Run database migration verification:
   ```bash
   npx jest tests/rls_tenant_isolation.test.ts
   ```
