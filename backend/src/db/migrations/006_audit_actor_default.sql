-- 006: Record the acting user on every audit entry.
-- The application sets app.current_user_id for each request's transactions
-- (from the authenticated user), so audit rows inserted without an explicit
-- user_id now default to the acting user instead of NULL. API-key actions stay NULL.
ALTER TABLE audit_logs ALTER COLUMN user_id SET DEFAULT current_app_user_id();
