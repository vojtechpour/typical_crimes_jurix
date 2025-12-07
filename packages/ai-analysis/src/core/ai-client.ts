/**
 * Unified AI Client
 * Provides a single interface for all AI providers
 */

import { OpenAIAnalyzer, createOpenAIAnalyzer } from '../providers/openai-analyzer.js';
import { GeminiAnalyzer, createGeminiAnalyzer } from '../providers/gemini-analyzer.js';
import { ClaudeAnalyzer, createClaudeAnalyzer } from '../providers/claude-analyzer.js';
import type { AIProvider, AIAnalysisResponse, AIProviderConfig } from '@crime-themes/shared';

export interface AIClientConfig {
  openaiApiKey?: string;
  geminiApiKey?: string;
  claudeApiKey?: string;
  defaultProvider?: AIProvider;
  defaultModel?: string;
}

export class AIClient {
  private openai?: OpenAIAnalyzer;
  private gemini?: GeminiAnalyzer;
  private claude?: ClaudeAnalyzer;
  private defaultProvider: AIProvider;

  constructor(config: AIClientConfig) {
    if (config.openaiApiKey) {
      this.openai = createOpenAIAnalyzer(config.openaiApiKey);
    }
    if (config.geminiApiKey) {
      this.gemini = createGeminiAnalyzer(config.geminiApiKey);
    }
    if (config.claudeApiKey) {
      this.claude = createClaudeAnalyzer(config.claudeApiKey);
    }

    // Determine default provider
    this.defaultProvider = config.defaultProvider || this.detectDefaultProvider();
  }

  private detectDefaultProvider(): AIProvider {
    if (this.gemini) return 'gemini';
    if (this.openai) return 'openai';
    if (this.claude) return 'claude';
    throw new Error('No AI provider configured. Please provide at least one API key.');
  }

  /**
   * Analyze text using the specified or default provider
   */
  async analyze(
    systemPrompt: string,
    userPrompt: string,
    options?: { provider?: AIProvider; model?: string }
  ): Promise<AIAnalysisResponse> {
    const provider = options?.provider || this.defaultProvider;
    
    switch (provider) {
      case 'openai':
        if (!this.openai) {
          throw new Error('OpenAI not configured. Please provide OPENAI_API_KEY.');
        }
        return this.openai.analyze(systemPrompt, userPrompt);
      
      case 'gemini':
        if (!this.gemini) {
          throw new Error('Gemini not configured. Please provide GEMINI_API_KEY.');
        }
        return this.gemini.analyze(systemPrompt, userPrompt);
      
      case 'claude':
        if (!this.claude) {
          throw new Error('Claude not configured. Please provide ANTHROPIC_API_KEY.');
        }
        return this.claude.analyze(systemPrompt, userPrompt);
      
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Count tokens (only supported for Gemini)
   */
  async countTokens(text: string): Promise<number> {
    if (this.gemini) {
      return this.gemini.countTokens(text);
    }
    // Fallback estimation: ~4 characters per token
    return Math.max(1, Math.floor(text.length / 4));
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): AIProvider {
    return this.defaultProvider;
  }

  /**
   * Check if a provider is available
   */
  hasProvider(provider: AIProvider): boolean {
    switch (provider) {
      case 'openai':
        return !!this.openai;
      case 'gemini':
        return !!this.gemini;
      case 'claude':
        return !!this.claude;
      default:
        return false;
    }
  }
}

/**
 * Create an AI client from environment variables
 */
export function createAIClient(config?: Partial<AIClientConfig>): AIClient {
  return new AIClient({
    openaiApiKey: process.env['OPENAI_API_KEY'] || config?.openaiApiKey,
    geminiApiKey: process.env['GEMINI_API_KEY'] || config?.geminiApiKey,
    claudeApiKey: process.env['ANTHROPIC_API_KEY'] || config?.claudeApiKey,
    defaultProvider: (process.env['MODEL_PROVIDER'] as AIProvider) || config?.defaultProvider,
    defaultModel: process.env['MODEL'] || config?.defaultModel,
  });
}



