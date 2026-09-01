import { Router, Request, Response } from 'express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { authenticate, requireRole } from '../../middleware/auth';

import { checkQuota } from '../../middleware/quota';

const router = Router();
router.use(authenticate);

router.post('/', checkQuota('knowledge_bases'), requireRole(['OWNER', 'ADMIN', 'MEMBER']), async (req: Request, res: Response) => {
  try {
    const { name, description, chunkSize, chunkOverlap } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name is required' } });
    }
    const data = await KnowledgeBaseService.createKnowledgeBase(
      req.user!.organizationId,
      name,
      description,
      chunkSize,
      chunkOverlap
    );
    return res.status(201).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'KB_CREATE_FAILED', message: error.message } });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await KnowledgeBaseService.listKnowledgeBases(req.user!.organizationId);
    return res.status(200).json({ data: { knowledgeBases: data } });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'KB_FETCH_FAILED', message: error.message } });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const data = await KnowledgeBaseService.getKnowledgeBase(req.user!.organizationId, req.params.id as string);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(404).json({ error: { code: 'KB_NOT_FOUND', message: error.message } });
  }
});

router.delete('/:id', requireRole(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const data = await KnowledgeBaseService.deleteKnowledgeBase(req.user!.organizationId, req.params.id as string);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'KB_DELETE_FAILED', message: error.message } });
  }
});

export const knowledgeBaseRouter = router;
