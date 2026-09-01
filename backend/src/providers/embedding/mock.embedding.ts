import crypto from 'crypto';
import { EmbeddingProvider } from './embedding.interface';

export class MockEmbeddingProvider implements EmbeddingProvider {
  name = 'MockEmbeddingProvider';
  dimension = 1536;

  async embedQuery(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateDeterministicVector(t));
  }

  private generateDeterministicVector(text: string): number[] {
    const hash = crypto.createHash('sha256').update(text).digest();
    const vec: number[] = new Array(this.dimension);

    let sumSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      const val = (hash[i % hash.length] / 255.0) * 2 - 1;
      vec[i] = val;
      sumSq += val * val;
    }

    const norm = Math.sqrt(sumSq) || 1;
    return vec.map((v) => v / norm);
  }
}
