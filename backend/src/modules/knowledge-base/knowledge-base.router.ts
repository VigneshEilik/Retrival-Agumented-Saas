import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { KnowledgeBaseService } from './knowledge-base.service';
import { authenticate, requireRole } from '../../middleware/auth';
import { checkQuota } from '../../middleware/quota';
import { validate, uuidParam, trimmedString } from '../../middleware/validate';

const router = Router();
router.use(authenticate);

const createSchema = z
  .object({
    name: trimmedString(1, 120, 'Name'),
    description: z.string().trim().max(1000).optional(),
    chunkSize: z.coerce.number().int().min(200).max(4000).default(1000),
    chunkOverlap: z.coerce.number().int().min(0).max(1000).default(150),
  })
  .refine((v) => v.chunkOverlap < v.chunkSize, { message: 'chunkOverlap must be smaller than chunkSize', path: ['chunkOverlap'] });

router.post(
  '/',
  requireRole(['OWNER', 'ADMIN', 'MEMBER']),
  validate({ body: createSchema }),
  checkQuota('knowledge_bases'),
  async (req: Request, res: Response) => {
    const { name, description, chunkSize, chunkOverlap } = req.body;
    const data = await KnowledgeBaseService.createKnowledgeBase(req.user!.organizationId, name, description, chunkSize, chunkOverlap);
    res.status(201).json({ data });
  }
);

router.get('/', async (req: Request, res: Response) => {
  const data = await KnowledgeBaseService.listKnowledgeBases(req.user!.organizationId);
  res.status(200).json({ data: { knowledgeBases: data } });
});

router.get('/:id', validate({ params: uuidParam('id') }), async (req: Request, res: Response) => {
  const data = await KnowledgeBaseService.getKnowledgeBase(req.user!.organizationId, req.params.id as string);
  res.status(200).json({ data });
});

router.delete('/:id', requireRole(['OWNER', 'ADMIN']), validate({ params: uuidParam('id') }), async (req: Request, res: Response) => {
  const data = await KnowledgeBaseService.deleteKnowledgeBase(req.user!.organizationId, req.params.id as string);
  res.status(200).json({ data });
});

export const knowledgeBaseRouter = router;
