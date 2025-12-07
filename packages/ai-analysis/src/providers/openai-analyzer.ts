/**
 * OpenAI GPT-4 Analyzer
 * TypeScript port of gpt4.py
 */

import OpenAI from 'openai';
import type { AIProvider, AIAnalysisResponse } from '@crime-themes/shared';

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

const DEFAULT_CONFIG = {
  model: 'gpt-4o',
  temperature: 1,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
} as const;

export class OpenAIAnalyzer {
  private client: OpenAI;
  private config: Required<OpenAIConfig>;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  async analyze(
    systemPrompt: string,
    userPrompt: string,
    maxRetries = 5
  ): Promise<AIAnalysisResponse> {
    const startTime = new Date();
    console.log(`[OpenAI] Sending request at ${startTime.toISOString()}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          top_p: this.config.topP,
          frequency_penalty: this.config.frequencyPenalty,
          presence_penalty: this.config.presencePenalty,
        });

        const content = response.choices[0]?.message?.content ?? '';
        const endTime = new Date();
        console.log(`[OpenAI] Response received at ${endTime.toISOString()}`);

        return {
          content,
          provider: 'openai' as AIProvider,
          model: this.config.model,
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.toLowerCase().includes('rate limit')) {
          console.log(`[OpenAI] Rate limit hit, waiting 60s (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(60000);
          continue;
        }
        
        throw error;
      }
    }

    throw new Error(`[OpenAI] Failed after ${maxRetries} attempts due to rate limits`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create an OpenAI analyzer instance
 */
export function createOpenAIAnalyzer(apiKey: string, options?: Partial<OpenAIConfig>): OpenAIAnalyzer {
  return new OpenAIAnalyzer({ apiKey, ...options });
}



