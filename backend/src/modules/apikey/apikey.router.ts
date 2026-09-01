import { Router, Request, Response } from 'express';
import { ApiKeyService } from './apikey.service';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/', requireRole(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const { name, expiresInDays } = req.body;
    if (!name) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name is required' } });
    }
    const data = await ApiKeyService.createApiKey(req.user!.organizationId, name, expiresInDays);
    return res.status(201).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'API_KEY_CREATE_FAILED', message: error.message } });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const keys = await ApiKeyService.listApiKeys(req.user!.organizationId);
    return res.status(200).json({ data: { apiKeys: keys } });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'API_KEY_FETCH_FAILED', message: error.message } });
  }
});

router.delete('/:id', requireRole(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  try {
    const apiKeyId = req.params.id as string;
    const data = await ApiKeyService.revokeApiKey(req.user!.organizationId, apiKeyId);
    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'API_KEY_REVOKE_FAILED', message: error.message } });
  }
});

export const apiKeyRouter = router;
