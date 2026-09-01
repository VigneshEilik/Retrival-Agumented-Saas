import { LLMProvider } from './llm.interface';
import { MockLLMProvider } from './mock.llm';

let currentLLMProvider: LLMProvider = new MockLLMProvider();

export function getLLMProvider(): LLMProvider {
  return currentLLMProvider;
}

export function setLLMProvider(provider: LLMProvider): void {
  currentLLMProvider = provider;
}

export * from './llm.interface';
export * from './mock.llm';
