import { Request, Response } from 'express';
import { z } from 'zod';
import { OrganizationService } from './organization.service';
import { AppError, badRequest } from '../../middleware/error_handler';
import { trimmedString } from '../../middleware/validate';

const assignableRole = z.enum(['ADMIN', 'MEMBER', 'VIEWER'], {
  errorMap: () => ({ message: 'Role must be ADMIN, MEMBER or VIEWER' }),
});

export const updateOrgSchema = z.object({ name: trimmedString(1, 255, 'Name') });
export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  role: assignableRole,
});
export const updateRoleSchema = z.object({ role: assignableRole });

// Known business-rule messages thrown by OrganizationService → HTTP status.
const BUSINESS_ERRORS: Array<[RegExp, number]> = [
  [/not found/i, 404],
  [/already a member/i, 409],
  [/cannot remove the organization OWNER|OWNER's role cannot be changed/i, 400],
];

/**
 * Maps service-level business errors to 4xx with the established error codes.
 * Anything else (e.g. database failures) goes to the central handler and is never echoed.
 */
async function run<T>(code: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    const msg: string = error?.message || '';
    const match = BUSINESS_ERRORS.find(([re]) => re.test(msg));
    if (match) throw new AppError(msg, match[1], code);
    throw error;
  }
}

export class OrganizationController {
  static async getOrganization(req: Request, res: Response) {
    const data = await run('ORG_FETCH_FAILED', () => OrganizationService.getOrganization(req.user!.organizationId));
    res.status(200).json({ data });
  }

  static async updateOrganization(req: Request, res: Response) {
    const data = await run('ORG_UPDATE_FAILED', () => OrganizationService.updateOrganization(req.user!.organizationId, req.body.name));
    res.status(200).json({ data });
  }

  static async listMembers(req: Request, res: Response) {
    const members = await run('MEMBERS_FETCH_FAILED', () => OrganizationService.listMembers(req.user!.organizationId));
    res.status(200).json({ data: { members } });
  }

  static async addMember(req: Request, res: Response) {
    const data = await run('ADD_MEMBER_FAILED', () =>
      OrganizationService.addMember(req.user!.organizationId, req.body.email, req.body.role)
    );
    res.status(201).json({ data });
  }

  static async updateMemberRole(req: Request, res: Response) {
    const targetUserId = req.params.userId as string;
    if (targetUserId === req.user!.userId) throw badRequest('You cannot change your own role', 'CANNOT_MODIFY_SELF');
    const data = await run('ROLE_UPDATE_FAILED', () =>
      OrganizationService.updateMemberRole(req.user!.organizationId, targetUserId, req.body.role)
    );
    res.status(200).json({ data });
  }

  static async removeMember(req: Request, res: Response) {
    const targetUserId = req.params.userId as string;
    if (targetUserId === req.user!.userId) throw badRequest('You cannot remove yourself', 'CANNOT_MODIFY_SELF');
    const data = await run('REMOVE_MEMBER_FAILED', () => OrganizationService.removeMember(req.user!.organizationId, targetUserId));
    res.status(200).json({ data });
  }
}
