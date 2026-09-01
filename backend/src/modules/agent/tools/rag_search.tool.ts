import { Tool, ToolExecutionContext, ToolPermission, ToolRiskLevel } from './tool.interface';
import { HybridRetriever } from '../../RAG/retrieval/hybrid.retriever';
import { CitationResolver } from '../../RAG/orchestration/citation.resolver';

export class RAGSearchTool implements Tool {
  name = 'RAGSearchTool';
  description = 'Searches tenant knowledge base documents for relevant grounded context and citations.';
  requiredPermissions: ToolPermission[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
  riskLevel: ToolRiskLevel = 'LOW';

  inputSchema = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query to find relevant document chunks.' },
      topK: { type: 'number', description: 'Optional maximum number of candidate chunks to retrieve.' },
    },
    required: ['query'],
  };

  private retriever = new HybridRetriever();

  async execute(context: ToolExecutionContext, params: { query: string; topK?: number }): Promise<any> {
    if (!context.knowledgeBaseId) {
      throw new Error('knowledgeBaseId context is required for RAGSearchTool');
    }

    const candidates = await this.retriever.retrieve({
      organizationId: context.organizationId,
      knowledgeBaseId: context.knowledgeBaseId,
      query: params.query,
      topK: params.topK || 5,
    });

    const citations = await CitationResolver.resolveCitations(context.organizationId, params.query, candidates);

    return {
      query: params.query,
      candidateCount: candidates.length,
      chunks: candidates.map((c, idx) => ({
        citationId: idx + 1,
        content: c.content,
        metadata: c.metadata,
        score: c.score,
      })),
      citations,
    };
  }
}
