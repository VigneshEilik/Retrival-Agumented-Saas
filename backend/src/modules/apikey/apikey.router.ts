import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ApiKeyService } from './apikey.service';
import { authenticate, requireRole, requireUser } from '../../middleware/auth';
import { validate, uuidParam, trimmedString } from '../../middleware/validate';
import { notFound } from '../../middleware/error_handler';

const router = Router();
// Key management is for signed-in admins only: an API key can never mint or revoke keys.
router.use(authenticate, requireUser);

const createKeySchema = z.object({
  name: trimmedString(1, 100, 'Name'),
  expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
});

router.post('/', requireRole(['OWNER', 'ADMIN']), validate({ body: createKeySchema }), async (req: Request, res: Response) => {
  const data = await ApiKeyService.createApiKey(req.user!.organizationId, req.body.name, req.body.expiresInDays);
  res.status(201).json({ data });
});

router.get('/', requireRole(['OWNER', 'ADMIN']), async (req: Request, res: Response) => {
  const keys = await ApiKeyService.listApiKeys(req.user!.organizationId);
  res.status(200).json({ data: { apiKeys: keys } });
});

router.delete('/:id', requireRole(['OWNER', 'ADMIN']), validate({ params: uuidParam('id') }), async (req: Request, res: Response) => {
  const data = await ApiKeyService.revokeApiKey(req.user!.organizationId, req.params.id as string);
  if (!data) throw notFound('API key not found or already revoked', 'API_KEY_NOT_FOUND');
  res.status(200).json({ data });
});

export const apiKeyRouter = router;
