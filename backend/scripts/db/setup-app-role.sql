-- Creates the least-privilege application role used by the API and worker.
--
-- Why: PostgreSQL superusers (and roles with BYPASSRLS) skip Row-Level Security,
-- so if the application connected as one, tenant isolation would silently stop working.
--
-- Run ONCE per environment as a superuser, connected to the application database:
--
--   psql "postgres://<superuser>@<host>:5432/<db>" \
--        -v app_role=rag_app \
--        -v app_password='<generate-a-strong-password>' \
--        -v owner_role=<role that runs migrations, e.g. postgres> \
--        -f scripts/db/setup-app-role.sql
--
-- Then set:
--   DATABASE_URL           = postgres://rag_app:<password>@<host>:5432/<db>
--   MIGRATION_DATABASE_URL = postgres://<owner_role>:<password>@<host>:5432/<db>
--
-- Safe to re-run (password is updated, grants re-applied).

\set ON_ERROR_STOP on

SELECT format('CREATE ROLE %I LOGIN', :'app_role')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role') \gexec

ALTER ROLE :"app_role" WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD :'app_password';

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_role') \gexec
GRANT USAGE ON SCHEMA public TO :"app_role";

-- Data access only: no DDL, no ownership.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"app_role";

-- Tables/functions created by future migrations (run as owner_role) are granted automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_role" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_role" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_role" IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO :"app_role";

-- The migration bookkeeping table is owner-only (if migrations have already run).
SELECT format('REVOKE ALL ON TABLE schema_migrations FROM %I', :'app_role')
WHERE to_regclass('public.schema_migrations') IS NOT NULL \gexec
