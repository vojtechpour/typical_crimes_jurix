/**
 * Phase 3 Analysis - Candidate Theme Generation
 * TypeScript implementation for generating candidate themes from initial codes
 */

import { AIClient } from './ai-client.js';
import { parseJsonResponse } from '../utils/response-parser.js';
import type { AIProvider } from '@crime-themes/shared';

export interface Phase3Config {
  tokenLimit?: number;
  completionLength?: number;
}

export interface Phase3Result {
  caseId: string;
  candidateTheme: string;
  success: boolean;
  error?: string;
}

export interface Phase3Progress {
  total: number;
  processed: number;
  percentage: number;
  uniqueThemes: number;
}

const DEFAULT_CONFIG: Required<Phase3Config> = {
  tokenLimit: 40000,
  completionLength: 2000,
};

/**
 * System prompt for Phase 3 analysis
 */
const SYSTEM_PROMPT = `You are an expert qualitative researcher specializing in thematic analysis.
Your task is to generate candidate themes from initial codes following the Braun & Clarke methodology.

Guidelines:
- Group related initial codes into broader candidate themes
- Each theme should represent a meaningful pattern in the data
- Themes should be descriptive but not too broad or too narrow
- Consider how codes relate to each other conceptually
- Be consistent with previously generated themes

Respond in JSON format with the case ID as the key and the candidate theme as the value.
Example: {"12345": "Property theft in residential settings"}`;

/**
 * Construct user prompt for Phase 3 analysis
 */
function constructUserPrompt(
  existingThemes: string[],
  caseData: { id: string; codes: string | string[] },
  globalInstructions?: string
): string {
  const codes = Array.isArray(caseData.codes) ? caseData.codes : [caseData.codes];
  
  let prompt = `Perform phase 3 of the thematic analysis, i.e., generate candidate themes from initial codes.

Below are all previously generated candidate themes for consistency.

EXISTING CANDIDATE THEMES:
`;

  if (existingThemes.length === 0) {
    prompt += 'This is the first case. No candidate themes have been generated yet.\n';
  } else {
    const uniqueThemes = [...new Set(existingThemes)].sort();
    prompt += uniqueThemes.map(theme => `- ${theme}`).join('\n') + '\n';
  }

  if (globalInstructions?.trim()) {
    prompt += `
SPECIAL INSTRUCTIONS:
${globalInstructions.trim()}
`;
  }

  prompt += `
CASE TO ANALYZE:
Case ID: ${caseData.id}
Initial Codes: ${codes.join(', ')}

Please generate a candidate theme for this case and respond in JSON format.`;

  return prompt;
}

/**
 * Phase 3 Analysis Engine
 */
export class Phase3Analysis {
  private client: AIClient;
  private config: Required<Phase3Config>;
  private existingThemes: string[] = [];
  private onProgress?: (progress: Phase3Progress) => void;

  constructor(
    client: AIClient,
    config?: Phase3Config,
    onProgress?: (progress: Phase3Progress) => void
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
    codes: string | string[],
    globalInstructions?: string,
    provider?: AIProvider
  ): Promise<Phase3Result> {
    const userPrompt = constructUserPrompt(
      this.existingThemes,
      { id: caseId, codes },
      globalInstructions
    );

    try {
      const response = await this.client.analyze(SYSTEM_PROMPT, userPrompt, { provider });
      const parsed = parseJsonResponse(response.content);

      if (parsed && caseId in parsed) {
        const theme = String(parsed[caseId]);
        this.existingThemes.push(theme);
        return { caseId, candidateTheme: theme, success: true };
      }

      return {
        caseId,
        candidateTheme: '',
        success: false,
        error: 'Case ID not found in response',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        caseId,
        candidateTheme: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Analyze multiple cases
   */
  async analyzeCases(
    cases: Array<{ id: string; codes: string | string[] }>,
    globalInstructions?: string,
    provider?: AIProvider
  ): Promise<Phase3Result[]> {
    const results: Phase3Result[] = [];
    const total = cases.length;

    for (let i = 0; i < cases.length; i++) {
      const caseData = cases[i]!;
      console.log(`[Phase3] Processing case ${i + 1}/${total}: ${caseData.id}`);

      const result = await this.analyzeCase(
        caseData.id,
        caseData.codes,
        globalInstructions,
        provider
      );
      results.push(result);

      // Emit progress update
      if (this.onProgress) {
        this.onProgress({
          total,
          processed: i + 1,
          percentage: ((i + 1) / total) * 100,
          uniqueThemes: this.getUniqueThemes().length,
        });
      }
    }

    return results;
  }

  /**
   * Set existing themes (for resuming analysis)
   */
  setExistingThemes(themes: string[]): void {
    this.existingThemes = themes;
  }

  /**
   * Get unique themes
   */
  getUniqueThemes(): string[] {
    return [...new Set(this.existingThemes)];
  }
}

/**
 * Create a Phase 3 analysis instance
 */
export function createPhase3Analysis(
  client: AIClient,
  config?: Phase3Config,
  onProgress?: (progress: Phase3Progress) => void
): Phase3Analysis {
  return new Phase3Analysis(client, config, onProgress);
}



