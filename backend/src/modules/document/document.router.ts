import { Router, Request, Response } from 'express';
import multer from 'multer';
import { DocumentService } from './document.service';
import { authenticate, requireRole } from '../../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

const router = Router();
router.use(authenticate);

// Document Upload under a Knowledge Base
router.post(
  '/knowledge-bases/:knowledgeBaseId/documents',
  requireRole(['OWNER', 'ADMIN', 'MEMBER']),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const knowledgeBaseId = req.params.knowledgeBaseId as string;
      const file = req.file;
      const title = req.body.title;

      if (!file) {
        return res.status(400).json({ error: { code: 'NO_FILE', message: 'Document file is required' } });
      }

      const data = await DocumentService.uploadDocument(
        req.user!.organizationId,
        knowledgeBaseId,
        file,
        title
      );

      return res.status(201).json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'UPLOAD_FAILED', message: error.message } });
    }
  }
);

// List documents under a Knowledge Base
router.get('/knowledge-bases/:knowledgeBaseId/documents', async (req: Request, res: Response) => {
  try {
    const knowledgeBaseId = req.params.knowledgeBaseId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const data = await DocumentService.listDocuments(req.user!.organizationId, knowledgeBaseId, page, limit);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'DOC_LIST_FAILED', message: error.message } });
  }
});

// Get document details and status
router.get('/documents/:id', async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id as string;
    const data = await DocumentService.getDocument(req.user!.organizationId, documentId);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(404).json({ error: { code: 'DOC_NOT_FOUND', message: error.message } });
  }
});

// Retry failed document ingestion
router.post('/documents/:id/retry', requireRole(['OWNER', 'ADMIN', 'MEMBER']), async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id as string;
    const data = await DocumentService.retryIngestion(req.user!.organizationId, documentId);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'RETRY_FAILED', message: error.message } });
  }
});

// Delete document and stored files
router.delete('/documents/:id', requireRole(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const documentId = req.params.id as string;
    const data = await DocumentService.deleteDocument(req.user!.organizationId, documentId);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'DELETE_FAILED', message: error.message } });
  }
});

export const documentRouter = router;
