/**
 * Google Gemini Analyzer
 * TypeScript port of gemini_api.py
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import type { AIProvider, AIAnalysisResponse } from '@crime-themes/shared';

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

const DEFAULT_CONFIG = {
  model: 'gemini-2.0-flash',
  temperature: 1,
  maxTokens: 2000,
  topP: 1,
} as const;

// Safety settings for crime data analysis - allow all content for research
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export class GeminiAnalyzer {
  private genAI: GoogleGenerativeAI;
  private config: Required<GeminiConfig>;

  constructor(config: GeminiConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
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
    console.log(`[Gemini] Sending request at ${startTime.toISOString()}`);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: this.config.model,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
            topP: this.config.topP,
          },
          safetySettings: SAFETY_SETTINGS,
        });

        const result = await model.generateContent(userPrompt);
        const response = result.response;
        
        // Check for blocked content
        if (response.candidates?.[0]?.finishReason === 'SAFETY') {
          throw new Error('Response blocked by Gemini safety filters. Try reducing batch size or content.');
        }
        
        const content = response.text();
        const endTime = new Date();
        console.log(`[Gemini] Response received at ${endTime.toISOString()}`);

        return {
          content,
          provider: 'gemini' as AIProvider,
          model: this.config.model,
          usage: response.usageMetadata
            ? {
                promptTokens: response.usageMetadata.promptTokenCount ?? 0,
                completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
                totalTokens: response.usageMetadata.totalTokenCount ?? 0,
              }
            : undefined,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('rate limit') ||
          errorMessage.toLowerCase().includes('resource_exhausted')
        ) {
          const waitTime = (attempt + 1) * 30000; // Progressive backoff
          console.log(`[Gemini] Rate limit hit, waiting ${waitTime / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(waitTime);
          continue;
        }
        
        throw error;
      }
    }

    throw new Error(`[Gemini] Failed after ${maxRetries} attempts due to rate limits`);
  }

  /**
   * Count tokens in text using Gemini's native token counting
   */
  async countTokens(text: string): Promise<number> {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    // Use simple estimation for very short texts
    if (text.length < 20) {
      return Math.max(1, Math.floor(text.length / 4));
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.config.model });
      const result = await model.countTokens(text);
      return result.totalTokens;
    } catch (error) {
      console.warn('[Gemini] Token counting failed, using estimation:', error);
      // Fallback: ~4 characters per token for Gemini
      return Math.max(1, Math.floor(text.length / 4));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a Gemini analyzer instance
 */
export function createGeminiAnalyzer(apiKey: string, options?: Partial<GeminiConfig>): GeminiAnalyzer {
  return new GeminiAnalyzer({ apiKey, ...options });
}



