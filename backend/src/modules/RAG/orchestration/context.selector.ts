import { CandidateChunk, ContextSelector } from '../retrieval/retrieval.interface';

export class TokenWindowContextSelector implements ContextSelector {
  selectContext(candidates: CandidateChunk[], maxTokens: number = 2000): CandidateChunk[] {
    const selected: CandidateChunk[] = [];
    let currentTokens = 0;

    for (const chunk of candidates) {
      // Rough token estimation: ~4 chars per token
      const estimatedTokens = Math.ceil(chunk.content.length / 4);
      if (currentTokens + estimatedTokens <= maxTokens) {
        selected.push(chunk);
        currentTokens += estimatedTokens;
      }
    }

    return selected;
  }
}
