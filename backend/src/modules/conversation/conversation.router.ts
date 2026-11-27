import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ConversationService } from './conversation.service';
import { RAGOrchestrator } from '../RAG/orchestration/rag.orchestrator';
import { authenticate } from '../../middleware/auth';
import { rateLimiter } from '../../middleware/rate_limiter';
import { validate, uuidParam, paginationQuery } from '../../middleware/validate';
import { badRequest } from '../../middleware/error_handler';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  knowledgeBaseId: z.string().uuid('knowledgeBaseId must be a valid UUID').optional(),
  title: z.string().trim().min(1).max(255).optional(),
});

const streamSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required').max(4000, 'Prompt must be at most 4000 characters'),
  // Optional: defaults to the knowledge base the conversation was created with.
  knowledgeBaseId: z.string().uuid('knowledgeBaseId must be a valid UUID').optional(),
});

// Create a conversation (optionally bound to a knowledge base)
router.post('/conversations', validate({ body: createSchema }), async (req: Request, res: Response) => {
  const { knowledgeBaseId, title } = req.body;
  const data = await ConversationService.createConversation(req.user!.organizationId, req.user!.userId, knowledgeBaseId, title);
  res.status(201).json({ data });
});

// List the caller's conversations
router.get('/conversations', validate({ query: paginationQuery }), async (req: Request, res: Response) => {
  const { page, limit } = req.validatedQuery;
  const data = await ConversationService.listConversations(req.user!.organizationId, req.user!.userId, page, limit);
  res.status(200).json({ data: { conversations: data } });
});

// Message history with persisted sources
router.get('/conversations/:id/messages', validate({ params: uuidParam('id') }), async (req: Request, res: Response) => {
  const data = await ConversationService.getConversationMessages(req.user!.organizationId, req.params.id as string, req.user!.userId);
  res.status(200).json({ data });
});

// Ask a question: streams the grounded answer as Server-Sent Events
router.post(
  '/conversations/:id/messages/stream',
  rateLimiter({ name: 'chat', scope: 'org', windowMs: 60_000, maxRequests: 60 }),
  validate({ params: uuidParam('id'), body: streamSchema }),
  async (req: Request, res: Response) => {
    const { organizationId, userId } = req.user!;
    // All access checks happen BEFORE the SSE stream opens, so failures are normal JSON errors.
    const conversation = await ConversationService.getAccessibleConversation(organizationId, userId, req.params.id as string);
    const knowledgeBaseId = req.body.knowledgeBaseId || conversation.knowledge_base_id;
    if (!knowledgeBaseId) {
      throw badRequest('knowledgeBaseId is required for a conversation without a default knowledge base');
    }
    await KnowledgeBaseService.getKnowledgeBase(organizationId, knowledgeBaseId); // 404 if not in this org

    await new RAGOrchestrator().executeStream({
      organizationId,
      userId,
      conversationId: conversation.id,
      knowledgeBaseId,
      prompt: req.body.prompt,
      res,
    });
  }
);

export const conversationRouter = router;
