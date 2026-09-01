import { HybridRetriever } from '../modules/RAG/retrieval/hybrid.retriever';
import { CitationResolver } from '../modules/RAG/orchestration/citation.resolver';
import { getLLMProvider } from '../providers/llm';
import { logger } from '../utils/logger';

export interface RAGEvalMetrics {
  retrievalRecall: number;
  contextRelevance: number;
  answerFaithfulness: number;
  citationAccuracy: number;
  averageLatencyMs: number;
}

export class RAGEvaluator {
  private retriever = new HybridRetriever();

  async evaluateDataset(
    organizationId: string,
    knowledgeBaseId: string,
    dataset: Array<{ question: string; expectedDocumentTitle?: string; expectedKeywords: string[] }>
  ): Promise<RAGEvalMetrics> {
    let recallHits = 0;
    let totalContextRelevance = 0;
    let faithfulAnswers = 0;
    let accurateCitations = 0;
    let totalLatency = 0;

    for (const item of dataset) {
      const startTime = Date.now();

      // 1. Evaluate Retrieval
      const candidates = await this.retriever.retrieve({
        organizationId,
        knowledgeBaseId,
        query: item.question,
        topK: 5,
      });

      const latency = Date.now() - startTime;
      totalLatency += latency;

      if (candidates.length > 0) {
        recallHits += 1;
        // Normalize RRF scores (RRF max candidate score is ~0.016, scale by 60 for 0..1 relevance)
        const avgScore = candidates.reduce((acc, c) => acc + (c.score * 60), 0) / candidates.length;
        totalContextRelevance += Math.min(1.0, avgScore);
      }

      // 2. Evaluate Citations
      const citations = await CitationResolver.resolveCitations(organizationId, item.question, candidates);
      if (citations.length > 0 && citations.every((c) => c.chunkId && c.documentId)) {
        accurateCitations += 1;
      }

      // 3. Evaluate Generation & Faithfulness
      const llm = getLLMProvider();
      const answer = await llm.generateText([
        { role: 'system', content: 'Answer concisely using retrieved context.' },
        { role: 'user', content: item.question },
      ]);

      const containsKeywords = item.expectedKeywords.some((k) => answer.toLowerCase().includes(k.toLowerCase()));
      if (containsKeywords) {
        faithfulAnswers += 1;
      }
    }

    const total = dataset.length || 1;
    const metrics: RAGEvalMetrics = {
      retrievalRecall: parseFloat((recallHits / total).toFixed(2)),
      contextRelevance: parseFloat((totalContextRelevance / total).toFixed(2)),
      answerFaithfulness: parseFloat((faithfulAnswers / total).toFixed(2)),
      citationAccuracy: parseFloat((accurateCitations / total).toFixed(2)),
      averageLatencyMs: Math.round(totalLatency / total),
    };

    logger.info({ metrics }, 'Completed RAG Evaluation Suite execution');
    return metrics;
  }
}
