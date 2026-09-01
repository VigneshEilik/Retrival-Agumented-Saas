-- Migration: 002_agent_schema.sql
-- Production Agent, Tool Calling & Execution Tracking Schema with Row-Level Security

-- Add token & latency tracking to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS prompt_tokens INT DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS completion_tokens INT DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS latency_ms INT DEFAULT 0;

-- Add token_count column to document_chunks table
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS token_count INT DEFAULT 0;

-- Agent Configurations Table
CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  model VARCHAR(100) NOT NULL DEFAULT 'gemini-2.5-flash',
  system_prompt TEXT,
  max_steps INT NOT NULL DEFAULT 5,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configs FORCE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_agent_configs_policy') THEN
    CREATE POLICY tenant_agent_configs_policy ON agent_configs
      FOR ALL
      USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
      WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
  END IF;
END $$;

-- Agent Runs Table
CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  agent_config_id UUID REFERENCES agent_configs(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_steps INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10, 6) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_agent_runs_policy') THEN
    CREATE POLICY tenant_agent_runs_policy ON agent_runs
      FOR ALL
      USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
      WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
  END IF;
END $$;

-- Tool Calls Table
CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_name VARCHAR(100) NOT NULL,
  arguments JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  result JSONB,
  error_message TEXT,
  latency_ms INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_calls FORCE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_tool_calls_policy') THEN
    CREATE POLICY tenant_tool_calls_policy ON tool_calls
      FOR ALL
      USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
      WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
  END IF;
END $$;

-- Agent Steps Table
CREATE TABLE IF NOT EXISTS agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  state VARCHAR(50) NOT NULL,
  thought TEXT,
  action_type VARCHAR(100),
  latency_ms INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE agent_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_steps FORCE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_agent_steps_policy') THEN
    CREATE POLICY tenant_agent_steps_policy ON agent_steps
      FOR ALL
      USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid)
      WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid);
  END IF;
END $$;
