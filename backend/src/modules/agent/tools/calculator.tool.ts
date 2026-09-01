import { Tool, ToolExecutionContext, ToolPermission, ToolRiskLevel } from './tool.interface';

export class CalculatorTool implements Tool {
  name = 'CalculatorTool';
  description = 'Performs deterministic mathematical calculations and evaluates arithmetic expressions.';
  requiredPermissions: ToolPermission[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
  riskLevel: ToolRiskLevel = 'LOW';

  inputSchema = {
    type: 'object' as const,
    properties: {
      expression: { type: 'string', description: 'Arithmetic math expression to evaluate e.g. 4500 * 0.15' },
    },
    required: ['expression'],
  };

  async execute(context: ToolExecutionContext, params: { expression: string }): Promise<any> {
    const sanitized = params.expression.replace(/[^0-9+\-*/().\s]/g, '');
    if (!sanitized.trim()) {
      throw new Error('Invalid mathematical expression');
    }

    try {
      // Safe arithmetic evaluation using Function constructor on sanitized math string
      const result = new Function(`return (${sanitized});`)();
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Expression did not yield a valid number');
      }

      return {
        expression: params.expression,
        result,
      };
    } catch (e: any) {
      throw new Error(`Calculation error: ${e.message}`);
    }
  }
}
