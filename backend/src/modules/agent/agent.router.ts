import { Router, Request, Response } from 'express';
import { AgentOrchestrator } from './orchestrator/agent.orchestrator';
import { ToolRegistry } from './tools/tool.registry';
import { RAGSearchTool } from './tools/rag_search.tool';
import { CalculatorTool } from './tools/calculator.tool';
import { authenticate, requireUser } from '../../middleware/auth';
import { withTenantContext } from '../../db';

const router = Router();
router.use(authenticate, requireUser);

const registry = new ToolRegistry();
registry.registerTool(new RAGSearchTool());
registry.registerTool(new CalculatorTool());

// Execute Agent Run
router.post('/agent/runs', async (req: Request, res: Response) => {
  try {
    const { prompt, knowledgeBaseId, conversationId, maxSteps } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Prompt is required' } });
    }

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.run({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId!,
      userRole: req.user!.role,
      knowledgeBaseId,
      conversationId,
      prompt,
      // Hard cap (the cost guard also limits agent steps)
      maxSteps: Math.min(Math.max(parseInt(maxSteps, 10) || 5, 1), 5),
    });

    return res.status(200).json({ data: result });
  } catch (error: any) {
    throw error; // central handler: logged, never echoed in production
  }
});

// Get Agent Run Details, Steps & Tool Calls
router.get('/agent/runs/:id', async (req: Request, res: Response) => {
  try {
    const runId = req.params.id as string;
    const data = await withTenantContext(req.user!.organizationId, async (client) => {
      const runRes = await client.query(
        `SELECT id, conversation_id, status, started_at, completed_at, total_steps
         FROM agent_runs WHERE id = $1 AND organization_id = $2`,
        [runId, req.user!.organizationId]
      );

      if (runRes.rows.length === 0) {
        throw new Error('Agent run not found');
      }

      const stepsRes = await client.query(
        `SELECT step_number, state, thought, action_type, created_at
         FROM agent_steps WHERE agent_run_id = $1 AND organization_id = $2 ORDER BY step_number ASC`,
        [runId, req.user!.organizationId]
      );

      const toolCallsRes = await client.query(
        `SELECT tool_name, arguments, status, result, error_message, latency_ms, created_at
         FROM tool_calls WHERE agent_run_id = $1 AND organization_id = $2 ORDER BY created_at ASC`,
        [runId, req.user!.organizationId]
      );

      return {
        run: runRes.rows[0],
        steps: stepsRes.rows,
        toolCalls: toolCallsRes.rows,
      };
    });

    return res.status(200).json({ data });
  } catch (error: any) {
    if (/not found/i.test(error?.message || '')) return res.status(404).json({ error: { code: 'RUN_NOT_FOUND', message: 'Agent run not found' } });
    throw error;
  }
});

// List Allowed Registered Tools
router.get('/agent/tools', async (req: Request, res: Response) => {
  try {
    const tools = registry.listAllowedTools(req.user!.role);
    const data = tools.map((t) => ({
      name: t.name,
      description: t.description,
      requiredPermissions: t.requiredPermissions,
      riskLevel: t.riskLevel,
      inputSchema: t.inputSchema,
    }));
    return res.status(200).json({ data: { tools: data } });
  } catch (error: any) {
    throw error;
  }
});

export const agentRouter = router;
