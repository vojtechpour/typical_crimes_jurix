/**
 * Phase 2 Analysis - Initial Code Generation
 * TypeScript port of analysis_p2.py
 */

import { AIClient } from './ai-client.js';
import { parseJsonResponse } from '../utils/response-parser.js';
import type { CrimeCase, Phase2ProgressUpdate, AIProvider } from '@crime-themes/shared';

export interface Phase2Config {
  tokenLimit?: number;
  completionLength?: number;
  outputField?: string;
}

export interface Phase2Result {
  caseId: string;
  codes: string | string[];
  success: boolean;
  error?: string;
}

export interface Phase2Progress {
  total: number;
  processed: number;
  percentage: number;
  uniqueCodes: number;
}

const DEFAULT_CONFIG: Required<Phase2Config> = {
  tokenLimit: 40000,
  completionLength: 2000,
  outputField: 'initial_code_0',
};

/**
 * System prompt for Phase 2 analysis
 */
const SYSTEM_PROMPT = `You are an expert qualitative researcher specializing in thematic analysis of crime data. 
Your task is to generate initial codes for crime case descriptions following the Braun & Clarke methodology.

Guidelines:
- Generate concise, descriptive initial codes that capture the essence of each case
- Be consistent with previously assigned codes when similar patterns emerge
- Be specific rather than overly general
- Each code should represent a meaningful unit of analysis
- You may assign multiple codes to a single case if appropriate

Respond in JSON format with the case ID as the key and the code(s) as the value.
Example: {"12345": "theft of bicycle from residential area"}
Or for multiple codes: {"12345": ["theft of bicycle", "residential area", "unlocked property"]}`;

/**
 * Construct user prompt for Phase 2 analysis
 */
function constructUserPrompt(
  existingCodes: string[],
  caseData: { id: string; text: string },
  globalInstructions?: string
): string {
  let prompt = `Perform phase 2 of the thematic analysis, i.e., generate initial codes.

Below are all previously generated initial codes for consistency. When defining codes, try to be consistent with existing ones while being as specific as possible.

ALREADY IDENTIFIED INITIAL CODES:
`;

  if (existingCodes.length === 0) {
    prompt += 'This is the first batch. No initial codes have been assigned yet.\n';
  } else {
    const uniqueCodes = [...new Set(existingCodes)].sort();
    prompt += uniqueCodes.map(code => `- ${code}`).join('\n') + '\n';
  }

  if (globalInstructions?.trim()) {
    prompt += `
SPECIAL INSTRUCTIONS FOR CODE GENERATION:
${globalInstructions.trim()}

Please prioritize these instructions while maintaining accuracy and consistency with existing codes.
`;
  }

  prompt += `
DATA TO ANALYZE:
ID: ${caseData.id}
${caseData.text}
---

Please generate initial codes for this case and respond in JSON format.`;

  return prompt;
}

/**
 * Phase 2 Analysis Engine
 */
export class Phase2Analysis {
  private client: AIClient;
  private config: Required<Phase2Config>;
  private existingCodes: string[] = [];
  private onProgress?: (update: Phase2ProgressUpdate) => void;

  constructor(
    client: AIClient,
    config?: Phase2Config,
    onProgress?: (update: Phase2ProgressUpdate) => void
  ) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onProgress = onProgress;
  }

  /**
   * Analyze a single case
   */
  async analyzeCase(
    caseId: string,
    caseText: string,
    globalInstructions?: string,
    provider?: AIProvider
  ): Promise<Phase2Result> {
    const userPrompt = constructUserPrompt(
      this.existingCodes,
      { id: caseId, text: caseText },
      globalInstructions
    );

    try {
      const response = await this.client.analyze(SYSTEM_PROMPT, userPrompt, { provider });
      const parsed = parseJsonResponse(response.content);

      if (parsed && caseId in parsed) {
        const rawCodes = parsed[caseId];
        const codes: string | string[] = Array.isArray(rawCodes) 
          ? rawCodes.map(String) 
          : String(rawCodes);
        this.addCodes(codes);
        return { caseId, codes, success: true };
      }

      return {
        caseId,
        codes: [],
        success: false,
        error: 'Case ID not found in response',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        caseId,
        codes: [],
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Analyze multiple cases
   */
  async analyzeCases(
    cases: Array<{ id: string; text: string }>,
    globalInstructions?: string,
    provider?: AIProvider
  ): Promise<Phase2Result[]> {
    const results: Phase2Result[] = [];
    const total = cases.length;

    for (let i = 0; i < cases.length; i++) {
      const caseData = cases[i]!;
      console.log(`[Phase2] Processing case ${i + 1}/${total}: ${caseData.id}`);

      const result = await this.analyzeCase(
        caseData.id,
        caseData.text,
        globalInstructions,
        provider
      );
      results.push(result);

      // Emit progress update
      if (this.onProgress) {
        this.onProgress({
          type: 'case_completed',
          caseId: caseData.id,
          codes: result.codes,
          progress: {
            processed: i + 1,
            total,
            percentage: ((i + 1) / total) * 100,
            uniqueCodes: this.getUniqueCodes().length,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Add codes to the existing codes list
   */
  addCodes(codes: string | string[]): void {
    if (Array.isArray(codes)) {
      this.existingCodes.push(...codes.map(String));
    } else {
      this.existingCodes.push(String(codes));
    }
  }

  /**
   * Set existing codes (for resuming analysis)
   */
  setExistingCodes(codes: string[]): void {
    this.existingCodes = codes.map(String);
  }

  /**
   * Get unique codes
   */
  getUniqueCodes(): string[] {
    return [...new Set(this.existingCodes)];
  }

  /**
   * Get progress info
   */
  getProgress(processed: number, total: number): Phase2Progress {
    return {
      total,
      processed,
      percentage: total > 0 ? (processed / total) * 100 : 0,
      uniqueCodes: this.getUniqueCodes().length,
    };
  }
}

/**
 * Create a Phase 2 analysis instance
 */
export function createPhase2Analysis(
  client: AIClient,
  config?: Phase2Config,
  onProgress?: (update: Phase2ProgressUpdate) => void
): Phase2Analysis {
  return new Phase2Analysis(client, config, onProgress);
}

