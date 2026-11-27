import { Retriever, RetrievalParams, CandidateChunk } from './retrieval.interface';
import { VectorRetriever } from './vector.retriever';
import { KeywordRetriever } from './keyword.retriever';

export class HybridRetriever implements Retriever {
  name = 'HybridRetriever';
  private vectorRetriever: VectorRetriever;
  private keywordRetriever: KeywordRetriever;

  constructor() {
    this.vectorRetriever = new VectorRetriever();
    this.keywordRetriever = new KeywordRetriever();
  }

  async retrieve(params: RetrievalParams): Promise<CandidateChunk[]> {
    const topK = params.topK || 5;

    // Run vector and keyword retrieval concurrently
    const [vectorCandidates, keywordCandidates] = await Promise.all([
      this.vectorRetriever.retrieve({ ...params, topK: topK * 2 }),
      this.keywordRetriever.retrieve({ ...params, topK: topK * 2 }),
    ]);

    // Reciprocal Rank Fusion (RRF) algorithm to score and merge candidate sets
    const rrfScores = new Map<string, { candidate: CandidateChunk; rrfScore: number }>();
    const rrfK = 60;

    vectorCandidates.forEach((cand, rank) => {
      const score = 1 / (rrfK + rank + 1);
      rrfScores.set(cand.chunkId, { candidate: cand, rrfScore: score });
    });

    keywordCandidates.forEach((cand, rank) => {
      const score = 1 / (rrfK + rank + 1);
      if (rrfScores.has(cand.chunkId)) {
        rrfScores.get(cand.chunkId)!.rrfScore += score;
      } else {
        rrfScores.set(cand.chunkId, { candidate: cand, rrfScore: score });
      }
    });

    // RRF decides the ORDER. For the reported score we keep the most meaningful raw signal:
    // the semantic (cosine) similarity when the chunk was found by vector search, else the keyword-match ratio.
    const vectorScores = new Map(vectorCandidates.map((c) => [c.chunkId, c.score]));

    const merged = Array.from(rrfScores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK)
      .map(({ candidate }) => ({
        ...candidate,
        score: parseFloat((vectorScores.get(candidate.chunkId) ?? candidate.score).toFixed(4)),
      }));

    return merged;
  }
}
