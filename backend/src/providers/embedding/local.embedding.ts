import { EmbeddingProvider } from './embedding.interface';
import { logger } from '../../utils/logger';

/**
 * Real semantic embeddings computed locally (no API key, no cost) with a
 * sentence-transformers model running on ONNX Runtime.
 *
 * all-MiniLM-L6-v2 produces 384-dim vectors. The database column is
 * vector(1536), so vectors are zero-padded to `dimension`. Zero-padding does
 * not change dot products or norms, so cosine similarity is preserved exactly.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = 'LocalEmbeddingProvider';
  dimension = 1536;
  private modelId: string;
  private extractorPromise: Promise<any> | null = null;

  constructor(modelId = 'Xenova/all-MiniLM-L6-v2') {
    this.modelId = modelId;
  }

  private getExtractor(): Promise<any> {
    if (!this.extractorPromise) {
      logger.info({ model: this.modelId }, 'Loading local embedding model (first run downloads ~90MB)');
      this.extractorPromise = import('@huggingface/transformers')
        .then(({ pipeline, env }) => {
          // Persist downloaded model files (mount a volume here in containers).
          if (process.env.EMBEDDING_CACHE_DIR) env.cacheDir = process.env.EMBEDDING_CACHE_DIR;
          return pipeline('feature-extraction', this.modelId, { dtype: 'fp32' });
        })
        .catch((err) => {
          this.extractorPromise = null; // allow retry on next call
          throw err;
        });
    }
    return this.extractorPromise;
  }

  private pad(vec: number[]): number[] {
    if (vec.length >= this.dimension) return vec.slice(0, this.dimension);
    return vec.concat(new Array(this.dimension - vec.length).fill(0));
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getExtractor();
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    const [rows, cols] = output.dims as [number, number];
    const data = output.data as Float32Array;

    const vectors: number[][] = [];
    for (let r = 0; r < rows; r++) {
      vectors.push(this.pad(Array.from(data.subarray(r * cols, (r + 1) * cols))));
    }
    return vectors;
  }
}
