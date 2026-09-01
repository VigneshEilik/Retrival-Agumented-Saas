import { LLMProvider, LLMMessage, LLMOptions, LLMStreamResult } from './llm.interface';

export class MockLLMProvider implements LLMProvider {
  name = 'MockLLMProvider';
  model = 'mock-gemini-2.5-flash';

  async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const userMsg = messages.find((m) => m.role === 'user')?.content || 'question';
    return `Based on the provided knowledge base, here is the answer to your query: "${userMsg}". [1]`;
  }

  async generateStream(messages: LLMMessage[], options?: LLMOptions): Promise<LLMStreamResult> {
    const fullText = await this.generateText(messages, options);
    const tokens = fullText.split(' ');

    async function* tokenGenerator() {
      for (const token of tokens) {
        yield token + ' ';
        await new Promise((r) => setTimeout(r, 10)); // Simulate SSE stream delay
      }
    }

    return {
      textStream: tokenGenerator(),
      getMetadata: async () => ({
        promptTokens: 120,
        completionTokens: tokens.length,
        model: this.model,
      }),
    };
  }
}
