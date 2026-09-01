export interface EmbeddingProvider {
  name: string;
  dimension: number;
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
