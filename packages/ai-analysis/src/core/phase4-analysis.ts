/**
 * Phase 4 Analysis - Assign Final Themes
 * TypeScript implementation for assigning finalized themes to cases
 */

import { AIClient } from "./ai-client.js";
import { parseJsonResponse } from "../utils/response-parser.js";
import type { AIProvider } from "@crime-themes/shared";

export interface Phase4Config {
  tokenLimit?: number;
  completionLength?: number;
}

export interface Phase4Result {
  caseId: string;
  assignedTheme: string;
  success: boolean;
  error?: string;
}

export interface Phase4Progress {
  total: number;
  processed: number;
  percentage: number;
  themeCounts: Record<string, number>;
}

const DEFAULT_CONFIG: Required<Phase4Config> = {
  tokenLimit: 40000,
  completionLength: 2000,
};

/**
 * System prompt for Phase 4 analysis
 */
const SYSTEM_PROMPT = `You are an expert qualitative researcher specializing in thematic analysis.
Your task is to assign finalized themes to crime cases based on the case text and initial codes.

Guidelines:
- Choose the most appropriate theme from the provided list
- Consider the case text and initial codes when making your decision
- Be consistent in your assignments
- If no theme fits well, choose the closest match

Respond in JSON format with the case ID as the key and the assigned theme as the value.
Example: {"12345": "Property theft in residential settings"}`;

/**
 * Construct user prompt for Phase 4 analysis
 */
function constructUserPrompt(
  finalizedThemes: string[],
  caseData: { id: string; text: string; codes?: string | string[] },
  globalInstructions?: string
): string {
  const codes = caseData.codes
    ? Array.isArray(caseData.codes)
      ? caseData.codes
      : [caseData.codes]
    : [];

  let prompt = `Assign the most appropriate theme to this case from the finalized theme list.

FINALIZED THEMES:
${finalizedThemes.map((theme, i) => `${i + 1}. ${theme}`).join("\n")}
`;

  if (globalInstructions?.trim()) {
    prompt += `
SPECIAL INSTRUCTIONS:
${globalInstructions.trim()}
`;
  }

  prompt += `
CASE TO ANALYZE:
Case ID: ${caseData.id}
Case Text: ${caseData.text}
`;

  if (codes.length > 0) {
    prompt += `Initial Codes: ${codes.join(", ")}\n`;
  }

  prompt += `
Please assign the most appropriate theme from the list above and respond in JSON format.`;

  return prompt;
}

/**
 * Phase 4 Analysis Engine
 */
export class Phase4Analysis {
  private client: AIClient;
  private config: Required<Phase4Config>;
  private finalizedThemes: string[] = [];
  private themeCounts: Record<string, number> = {};
  private onProgress?: (progress: Phase4Progress) => void;

  constructor(
    client: AIClient,
    config?: Phase4Config,
    onProgress?: (progress: Phase4Progress) => void
  ) {
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.onProgress = onProgress;
  }

  /**
   * Set the finalized themes to assign from
   */
  setFinalizedThemes(themes: string[]): void {
    this.finalizedThemes = themes;
    // Initialize counts
    this.themeCounts = {};
    for (const theme of themes) {
      this.themeCounts[theme] = 0;
    }
  }

  /**
   * Assign theme to a single case
   */
  async assignTheme(
    caseId: string,
    caseText: string,
    codes?: string | string[],
    globalInstructions?: string,
    provider?: AIProvider
  ): Promise<Phase4Result> {
    if (this.finalizedThemes.length === 0) {
      return {
        caseId,
        assignedTheme: "",
        success: false,
        error: "No finalized themes set",
      };
    }

    const userPrompt = constructUserPrompt(
      this.finalizedThemes,
      { id: caseId, text: caseText, codes },
      globalInstructions
    );

    try {
      const response = await this.client.analyze(SYSTEM_PROMPT, userPrompt, {
        provider,
      });
      const parsed = parseJsonResponse(response.content);

      if (parsed && caseId in parsed) {
        const theme = String(parsed[caseId]);
        // Validate theme is in the list
        if (this.finalizedThemes.includes(theme)) {
          this.themeCounts[theme] = (this.themeCounts[theme] || 0) + 1;
          return { caseId, assignedTheme: theme, success: true };
        }
        // Try to find closest match
        const closestTheme = this.findClosestTheme(theme);
        if (closestTheme) {
          this.themeCounts[closestTheme] =
            (this.themeCounts[closestTheme] || 0) + 1;
          return { caseId, assignedTheme: closestTheme, success: true };
        }
      }

      return {
        caseId,
        assignedTheme: "",
        success: false,
        error: "Invalid or missing theme in response",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        caseId,
        assignedTheme: "",
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Assign themes to multiple cases
   */
  async assignThemes(
    cases: Array<{ id: string; text: string; codes?: string | string[] }>,
    globalInstructions?: string,
    provider?: AIProvider
  ): Promise<Phase4Result[]> {
    const results: Phase4Result[] = [];
    const total = cases.length;

    for (let i = 0; i < cases.length; i++) {
      const caseData = cases[i]!;
      console.log(`[Phase4] Processing case ${i + 1}/${total}: ${caseData.id}`);

      const result = await this.assignTheme(
        caseData.id,
        caseData.text,
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
          themeCounts: { ...this.themeCounts },
        });
      }
    }

    return results;
  }

  /**
   * Find the closest matching theme
   */
  private findClosestTheme(input: string): string | null {
    const inputLower = input.toLowerCase();
    for (const theme of this.finalizedThemes) {
      if (
        theme.toLowerCase().includes(inputLower) ||
        inputLower.includes(theme.toLowerCase())
      ) {
        return theme;
      }
    }
    return null;
  }

  /**
   * Get theme counts
   */
  getThemeCounts(): Record<string, number> {
    return { ...this.themeCounts };
  }
}

/**
 * Create a Phase 4 analysis instance
 */
export function createPhase4Analysis(
  client: AIClient,
  config?: Phase4Config,
  onProgress?: (progress: Phase4Progress) => void
): Phase4Analysis {
  return new Phase4Analysis(client, config, onProgress);
}
