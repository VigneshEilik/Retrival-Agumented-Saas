export interface CandidateChunk {
  chunkId: string;
  documentId: string;
  documentVersionId: string;
  content: string;
  metadata: {
    pageNumber?: number;
    sectionTitle?: string;
    sourceFilename?: string;
    [key: string]: any;
  };
  score: number;
}

export interface RetrievalParams {
  organizationId: string;
  knowledgeBaseId: string;
  query: string;
  topK?: number;
  minScore?: number;
}

export interface Retriever {
  name: string;
  retrieve(params: RetrievalParams): Promise<CandidateChunk[]>;
}

export interface Reranker {
  name: string;
  rerank(query: string, candidates: CandidateChunk[], topK: number): Promise<CandidateChunk[]>;
}

export interface ContextSelector {
  selectContext(candidates: CandidateChunk[], maxTokens?: number): CandidateChunk[];
}
