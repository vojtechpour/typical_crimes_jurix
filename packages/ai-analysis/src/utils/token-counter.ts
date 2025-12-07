/**
 * Token Counter Utilities
 * Provides token estimation for different AI providers
 */

/**
 * Estimate token count based on character count
 * This is a rough estimation - actual tokens vary by model
 * 
 * Approximations:
 * - GPT models: ~4 characters per token
 * - Gemini: ~4 characters per token
 * - Claude: ~4 characters per token
 */
export function estimateTokens(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }
  // ~4 characters per token is a reasonable estimate for most models
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Check if text fits within token limit
 */
export function fitsWithinLimit(
  systemPrompt: string,
  userPrompt: string,
  completionLength: number,
  tokenLimit: number
): boolean {
  const estimatedTotal = 
    estimateTokens(systemPrompt) + 
    estimateTokens(userPrompt) + 
    completionLength;
  
  return estimatedTotal <= tokenLimit;
}

/**
 * Calculate available tokens for data after accounting for prompts
 */
export function availableDataTokens(
  systemPrompt: string,
  userPromptTemplate: string,
  completionLength: number,
  tokenLimit: number
): number {
  const baseTokens = 
    estimateTokens(systemPrompt) + 
    estimateTokens(userPromptTemplate) + 
    completionLength;
  
  return Math.max(0, tokenLimit - baseTokens);
}

/**
 * Split text into chunks that fit within token limit
 */
export function chunkText(text: string, maxTokens: number): string[] {
  const chunks: string[] = [];
  const maxChars = maxTokens * 4; // Convert tokens to approximate characters
  
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }
    
    // Find a good break point (newline or sentence end)
    let breakPoint = maxChars;
    const newlineIndex = remaining.lastIndexOf('\n', maxChars);
    const periodIndex = remaining.lastIndexOf('. ', maxChars);
    
    if (newlineIndex > maxChars * 0.5) {
      breakPoint = newlineIndex + 1;
    } else if (periodIndex > maxChars * 0.5) {
      breakPoint = periodIndex + 2;
    }
    
    chunks.push(remaining.substring(0, breakPoint));
    remaining = remaining.substring(breakPoint).trim();
  }
  
  return chunks;
}



