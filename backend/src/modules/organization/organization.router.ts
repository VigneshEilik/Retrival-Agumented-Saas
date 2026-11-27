import { Router } from 'express';
import { OrganizationController, updateOrgSchema, addMemberSchema, updateRoleSchema } from './organization.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { checkQuota } from '../../middleware/quota';
import { validate, uuidParam } from '../../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/', OrganizationController.getOrganization);
router.patch('/', requireRole(['OWNER', 'ADMIN']), validate({ body: updateOrgSchema }), OrganizationController.updateOrganization);
router.get('/members', OrganizationController.listMembers);
router.post(
  '/members',
  requireRole(['OWNER', 'ADMIN']),
  validate({ body: addMemberSchema }),
  checkQuota('members'),
  OrganizationController.addMember
);
router.patch(
  '/members/:userId/role',
  requireRole(['OWNER']),
  validate({ params: uuidParam('userId'), body: updateRoleSchema }),
  OrganizationController.updateMemberRole
);
router.delete('/members/:userId', requireRole(['OWNER', 'ADMIN']), validate({ params: uuidParam('userId') }), OrganizationController.removeMember);

export const organizationRouter = router;
