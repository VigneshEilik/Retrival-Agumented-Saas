import { Tool, ToolExecutionContext, ToolPermission } from './tool.interface';
import { logger } from '../../../utils/logger';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn({ toolName: tool.name }, 'Overwriting existing registered tool');
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listAllowedTools(userRole: string): Tool[] {
    const roleHierarchy: Record<string, number> = {
      OWNER: 4,
      ADMIN: 3,
      MEMBER: 2,
      VIEWER: 1,
    };

    const userRank = roleHierarchy[userRole] || 0;

    return Array.from(this.tools.values()).filter((tool) => {
      const minRequiredRank = Math.min(...tool.requiredPermissions.map((p) => roleHierarchy[p] || 5));
      return userRank >= minRequiredRank;
    });
  }

  async executeTool(name: string, context: ToolExecutionContext, params: any): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Requested tool '${name}' is not registered in ToolRegistry`);
    }

    // Server-Side Permission Enforcement
    const allowed = this.listAllowedTools(context.userRole);
    if (!allowed.some((t) => t.name === name)) {
      throw new Error(`Role '${context.userRole}' is not authorized to execute tool '${name}'`);
    }

    // Input Validation against required parameters
    if (tool.inputSchema.required) {
      for (const reqField of tool.inputSchema.required) {
        if (params[reqField] === undefined || params[reqField] === null) {
          throw new Error(`Missing required parameter '${reqField}' for tool '${name}'`);
        }
      }
    }

    logger.info({ toolName: name, userRole: context.userRole }, 'Executing authorized tool');
    return tool.execute(context, params);
  }
}
