import { Router, Request, Response } from 'express';
import { withTenantContext } from '../../db';
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const data = await withTenantContext(req.user!.organizationId, async (client) => {
      const logsRes = await client.query(
        `SELECT a.id, a.action, a.resource_type, a.resource_id, a.details, a.ip_address, a.created_at,
                u.email as user_email, u.full_name as user_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.organization_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user!.organizationId, limit, offset]
      );

      const countRes = await client.query(
        `SELECT COUNT(*) as total FROM audit_logs WHERE organization_id = $1`,
        [req.user!.organizationId]
      );

      return {
        logs: logsRes.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countRes.rows[0].total, 10),
        },
      };
    });

    return res.status(200).json({ data });
  } catch (error: any) {
    return res.status(400).json({ error: { code: 'AUDIT_LOG_FETCH_FAILED', message: error.message } });
  }
});

export const auditRouter = router;
