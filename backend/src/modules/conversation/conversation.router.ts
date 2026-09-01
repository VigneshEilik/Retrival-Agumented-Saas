import { Router, Request, Response } from 'express';
import { ConversationService } from './conversation.service';
import { RAGOrchestrator } from '../RAG/orchestration/rag.orchestrator';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// Create conversation
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const { knowledgeBaseId, title } = req.body;
    const data = await ConversationService.createConversation(
      req.user!.organizationId,
      req.user!.userId,
      knowledgeBaseId,
      title
    );
    return res.status(201).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'CONVERSATION_CREATE_FAILED', message: error.message } });
  }
});

// List user conversations
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const data = await ConversationService.listConversations(
      req.user!.organizationId,
      req.user!.userId,
      page,
      limit
    );
    return res.status(200).json({ data: { conversations: data } });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'CONVERSATION_FETCH_FAILED', message: error.message } });
  }
});

// Get message history for a conversation
router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id as string;
    const data = await ConversationService.getConversationMessages(req.user!.organizationId, conversationId);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(404).json({ error: { code: 'MESSAGES_FETCH_FAILED', message: error.message } });
  }
});

// Stream RAG response tokens via SSE
router.post('/conversations/:id/messages/stream', async (req: Request, res: Response) => {
  try {
    const conversationId = req.params.id as string;
    const { prompt, knowledgeBaseId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Prompt is required' } });
    }

    if (!knowledgeBaseId) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'knowledgeBaseId is required for RAG stream' } });
    }

    const orchestrator = new RAGOrchestrator();
    await orchestrator.executeStream({
      organizationId: req.user!.organizationId,
      userId: req.user!.userId,
      conversationId,
      knowledgeBaseId,
      prompt,
      res,
    });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'STREAM_FAILED', message: error.message } });
  }
});

export const conversationRouter = router;
