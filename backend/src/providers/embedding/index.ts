import { EmbeddingProvider } from './embedding.interface';
import { MockEmbeddingProvider } from './mock.embedding';

let currentEmbeddingProvider: EmbeddingProvider = new MockEmbeddingProvider();

export function getEmbeddingProvider(): EmbeddingProvider {
  return currentEmbeddingProvider;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  currentEmbeddingProvider = provider;
}

export * from './embedding.interface';
export * from './mock.embedding';
