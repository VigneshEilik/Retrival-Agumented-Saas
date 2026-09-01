import { Router } from 'express';
import { OrganizationController } from './organization.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', OrganizationController.getOrganization);
router.patch('/', requireRole(['OWNER', 'ADMIN']), OrganizationController.updateOrganization);
router.get('/members', OrganizationController.listMembers);
router.post('/members', requireRole(['OWNER', 'ADMIN']), OrganizationController.addMember);
router.patch('/members/:userId/role', requireRole(['OWNER']), OrganizationController.updateMemberRole);
router.delete('/members/:userId', requireRole(['OWNER', 'ADMIN']), OrganizationController.removeMember);

export const organizationRouter = router;
