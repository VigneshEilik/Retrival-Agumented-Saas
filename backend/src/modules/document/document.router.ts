import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { DocumentService } from './document.service';
import { authenticate, requireRole } from '../../middleware/auth';
import { checkQuota } from '../../middleware/quota';
import { rateLimiter } from '../../middleware/rate_limiter';
import { validate, uuidParam, paginationQuery } from '../../middleware/validate';
import { badRequest } from '../../middleware/error_handler';
import { config } from '../../config';

// Files are held in memory only for the duration of the request (bounded by MAX_UPLOAD_MB),
// then written to storage. One file per request.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 5 },
});

const router = Router();
router.use(authenticate);

const uploadBody = z.object({ title: z.string().trim().min(1).max(255).optional() });

// Upload a document into a knowledge base
router.post(
  '/knowledge-bases/:knowledgeBaseId/documents',
  requireRole(['OWNER', 'ADMIN', 'MEMBER']),
  rateLimiter({ name: 'upload', scope: 'org', windowMs: 60_000, maxRequests: 30 }),
  validate({ params: uuidParam('knowledgeBaseId') }),
  checkQuota('documents'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.file) throw badRequest('A document file is required in the "file" form field', 'NO_FILE');
    const { title } = uploadBody.parse(req.body ?? {});
    const data = await DocumentService.uploadDocument(req.user!.organizationId, req.params.knowledgeBaseId as string, req.file, title);
    res.status(201).json({ data });
  }
);

// List documents in a knowledge base (paginated)
router.get(
  '/knowledge-bases/:knowledgeBaseId/documents',
  validate({ params: uuidParam('knowledgeBaseId'), query: paginationQuery }),
  async (req: Request, res: Response) => {
    const { page, limit } = req.validatedQuery;
    const data = await DocumentService.listDocuments(req.user!.organizationId, req.params.knowledgeBaseId as string, page, limit);
    res.status(200).json({ data });
  }
);

// Document details and processing status
router.get('/documents/:id', validate({ params: uuidParam('id') }), async (req: Request, res: Response) => {
  const data = await DocumentService.getDocument(req.user!.organizationId, req.params.id as string);
  res.status(200).json({ data });
});

// Retry a failed ingestion
router.post(
  '/documents/:id/retry',
  requireRole(['OWNER', 'ADMIN', 'MEMBER']),
  validate({ params: uuidParam('id') }),
  async (req: Request, res: Response) => {
    const data = await DocumentService.retryIngestion(req.user!.organizationId, req.params.id as string);
    res.status(200).json({ data });
  }
);

// Delete a document, its chunks and its stored file
router.delete('/documents/:id', requireRole(['OWNER', 'ADMIN']), validate({ params: uuidParam('id') }), async (req: Request, res: Response) => {
  const data = await DocumentService.deleteDocument(req.user!.organizationId, req.params.id as string);
  res.status(200).json({ data });
});

export const documentRouter = router;
