import { CandidateChunk } from '../retrieval/retrieval.interface';

export interface GroundingCheckResult {
  isGrounded: boolean;
  reason?: string;
}

export class GroundingValidator {
  static validateContextSufficiency(query: string, chunks: CandidateChunk[]): GroundingCheckResult {
    if (!chunks || chunks.length === 0) {
      return {
        isGrounded: false,
        reason: 'Insufficient knowledge base context retrieved for this query.',
      };
    }

    const maxScore = Math.max(...chunks.map((c) => c.score));
    if (maxScore <= 0) {
      return {
        isGrounded: false,
        reason: 'Retrieved context relevance score is below the minimum threshold.',
      };
    }

    return { isGrounded: true };
  }
}
