import { EmbeddingProvider } from './embedding.interface';
import { MockEmbeddingProvider } from './mock.embedding';
import { LocalEmbeddingProvider } from './local.embedding';
import { config } from '../../config';

function createDefaultEmbeddingProvider(): EmbeddingProvider {
  if (config.embeddingProvider === 'local') {
    return new LocalEmbeddingProvider(config.embeddingModel);
  }
  return new MockEmbeddingProvider();
}

let currentEmbeddingProvider: EmbeddingProvider = createDefaultEmbeddingProvider();

export function getEmbeddingProvider(): EmbeddingProvider {
  return currentEmbeddingProvider;
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  currentEmbeddingProvider = provider;
}

export * from './embedding.interface';
export * from './mock.embedding';
export * from './local.embedding';
