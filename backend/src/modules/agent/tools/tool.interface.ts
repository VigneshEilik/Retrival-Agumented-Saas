export type ToolPermission = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ToolExecutionContext {
  organizationId: string;
  userId: string;
  userRole: string;
  knowledgeBaseId?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  outputSchema?: any;
  requiredPermissions: ToolPermission[];
  riskLevel: ToolRiskLevel;
  execute(context: ToolExecutionContext, params: any): Promise<any>;
}
