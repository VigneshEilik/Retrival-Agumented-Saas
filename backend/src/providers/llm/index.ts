import { LLMProvider } from './llm.interface';
import { MockLLMProvider } from './mock.llm';
import { GroqLLMProvider } from './groq.llm';
import { config } from '../../config';

function createDefaultLLMProvider(): LLMProvider {
  if (config.nodeEnv !== 'test' && config.groqApiKey) {
    return new GroqLLMProvider(config.groqApiKey, config.groqModel);
  }
  return new MockLLMProvider();
}

let currentLLMProvider: LLMProvider = createDefaultLLMProvider();

export function getLLMProvider(): LLMProvider {
  return currentLLMProvider;
}

export function setLLMProvider(provider: LLMProvider): void {
  currentLLMProvider = provider;
}

export * from './llm.interface';
export * from './mock.llm';
export * from './groq.llm';
