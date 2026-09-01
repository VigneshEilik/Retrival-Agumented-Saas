import { Request, Response } from 'express';
import { OrganizationService } from './organization.service';

export class OrganizationController {
  static async getOrganization(req: Request, res: Response) {
    try {
      const data = await OrganizationService.getOrganization(req.user!.organizationId);
      return res.status(200).json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'ORG_FETCH_FAILED', message: error.message } });
    }
  }

  static async updateOrganization(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name is required' } });
      }

      const data = await OrganizationService.updateOrganization(req.user!.organizationId, name);
      return res.status(200).json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'ORG_UPDATE_FAILED', message: error.message } });
    }
  }

  static async listMembers(req: Request, res: Response) {
    try {
      const members = await OrganizationService.listMembers(req.user!.organizationId);
      return res.status(200).json({ data: { members } });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'MEMBERS_FETCH_FAILED', message: error.message } });
    }
  }

  static async addMember(req: Request, res: Response) {
    try {
      const { email, role } = req.body;
      if (!email || !role) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email and role are required' } });
      }

      const data = await OrganizationService.addMember(req.user!.organizationId, email, role);
      return res.status(201).json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'ADD_MEMBER_FAILED', message: error.message } });
    }
  }

  static async updateMemberRole(req: Request, res: Response) {
    try {
      const userId = req.params.userId as string;
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Role is required' } });
      }

      const data = await OrganizationService.updateMemberRole(req.user!.organizationId, userId, role);
      return res.status(200).json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'ROLE_UPDATE_FAILED', message: error.message } });
    }
  }

  static async removeMember(req: Request, res: Response) {
    try {
      const userId = req.params.userId as string;
      const data = await OrganizationService.removeMember(req.user!.organizationId, userId);
      return res.status(200).json({ data });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'REMOVE_MEMBER_FAILED', message: error.message } });
    }
  }
}
