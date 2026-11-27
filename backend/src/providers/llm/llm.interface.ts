export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMStreamResult {
  textStream: AsyncIterable<string>;
  getMetadata(): Promise<{ promptTokens: number; completionTokens: number; model: string }>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  /** Cancels the request (client disconnect or timeout). */
  signal?: AbortSignal;
}

export interface LLMProvider {
  name: string;
  model: string;
  generateText(messages: LLMMessage[], options?: LLMOptions): Promise<string>;
  generateStream(messages: LLMMessage[], options?: LLMOptions): Promise<LLMStreamResult>;
}
