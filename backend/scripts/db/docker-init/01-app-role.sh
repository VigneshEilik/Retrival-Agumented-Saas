#!/bin/bash
# Runs once, when the PostgreSQL container initialises an EMPTY data directory.
# Creates the least-privilege application role (RLS enforced) and grants it data
# access to every table that migrations (run as $POSTGRES_USER) will create later.
set -euo pipefail

: "${APP_DB_USER:=rag_app}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set for the postgres container}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_role="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" -v owner_role="$POSTGRES_USER" \
  -f /docker-entrypoint-initdb.d/setup-app-role.sql.inc
