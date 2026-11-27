import { LLMProvider, LLMMessage, LLMOptions, LLMStreamResult } from './llm.interface';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

interface GroqUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

/**
 * LLM provider backed by Groq's OpenAI-compatible Chat Completions API.
 * Uses plain fetch + SSE parsing so no extra SDK dependency is needed.
 */
export class GroqLLMProvider implements LLMProvider {
  name = 'GroqLLMProvider';
  model: string;
  private apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private buildBody(messages: LLMMessage[], options: LLMOptions | undefined, stream: boolean) {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_completion_tokens: options?.maxTokens ?? 1024,
      stream,
    };
    if (stream) body.stream_options = { include_usage: true };
    // gpt-oss models are reasoning models: keep reasoning short and out of the answer text.
    if (this.model.startsWith('openai/gpt-oss')) {
      body.reasoning_effort = 'low';
      body.include_reasoning = false;
    }
    return body;
  }

  private async request(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    // Retry once on transient upstream failures (429 / 5xx) before any token was streamed.
    let res: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
      if (res.ok || !(res.status === 429 || res.status >= 500) || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 800));
    }
    res = res!;

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let message = text;
      try {
        message = JSON.parse(text)?.error?.message || text;
      } catch {
        /* keep raw text */
      }
      throw new Error(`Groq API error (${res.status}): ${message}`);
    }
    return res;
  }

  async generateText(messages: LLMMessage[], options?: LLMOptions): Promise<string> {
    const res = await this.request(this.buildBody(messages, options, false), options?.signal);
    const json: any = await res.json();
    return json?.choices?.[0]?.message?.content ?? '';
  }

  async generateStream(messages: LLMMessage[], options?: LLMOptions): Promise<LLMStreamResult> {
    const res = await this.request(this.buildBody(messages, options, true), options?.signal);
    if (!res.body) throw new Error('Groq API returned an empty stream');

    const model = this.model;
    let usage: GroqUsage = {};
    let resolveDone: () => void;
    const done = new Promise<void>((resolve) => (resolveDone = resolve));
    const body = res.body;

    async function* textStream(): AsyncIterable<string> {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (!line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (payload === '[DONE]') return;

            let chunk: any;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }
            if (chunk.error) throw new Error(`Groq stream error: ${chunk.error.message || 'unknown'}`);

            const u = chunk.usage || chunk.x_groq?.usage;
            if (u) usage = u;

            const token = chunk.choices?.[0]?.delta?.content;
            if (token) yield token;
          }
        }
      } finally {
        reader.releaseLock();
        resolveDone();
      }
    }

    return {
      textStream: textStream(),
      getMetadata: async () => {
        await done;
        return {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          model,
        };
      },
    };
  }
}
