/**
 * Anthropic Claude Analyzer
 * TypeScript implementation for Claude models
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIAnalysisResponse } from '@crime-themes/shared';

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const DEFAULT_CONFIG = {
  model: 'claude-sonnet-4-5-20250929',
  temperature: 1,
  maxTokens: 2000,
} as const;

export class ClaudeAnalyzer {
  private client: Anthropic;
  private config: Required<ClaudeConfig>;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
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
    console.log(`[Claude] Sending request at ${startTime.toISOString()}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt },
          ],
        });

        // Extract text content from response
        const textContent = response.content.find(block => block.type === 'text');
        const content = textContent?.type === 'text' ? textContent.text : '';
        
        const endTime = new Date();
        console.log(`[Claude] Response received at ${endTime.toISOString()}`);

        return {
          content,
          provider: 'claude' as AIProvider,
          model: this.config.model,
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('quota')
        ) {
          console.log(`[Claude] Rate limit hit, waiting 60s (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(60000);
          continue;
        }
        
        throw error;
      }
    }

    throw new Error(`[Claude] Failed after ${maxRetries} attempts due to rate limits`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a Claude analyzer instance
 */
export function createClaudeAnalyzer(apiKey: string, options?: Partial<ClaudeConfig>): ClaudeAnalyzer {
  return new ClaudeAnalyzer({ apiKey, ...options });
}



