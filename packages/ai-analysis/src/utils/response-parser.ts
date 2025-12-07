/**
 * Response Parser Utilities
 * Handles parsing of AI responses including JSON extraction from markdown
 */

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
export function parseJsonResponse(
  response: string
): Record<string, unknown> | null {
  let content = response.trim();

  // Handle markdown JSON code blocks
  if (content.includes("```json")) {
    const match = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      content = match[1].trim();
    }
  } else if (content.includes("```")) {
    // Handle generic code blocks - find one that looks like JSON
    const blocks = content.split("```");
    for (let i = 1; i < blocks.length; i += 2) {
      const block = blocks[i]?.trim() ?? "";
      if (block.startsWith("{") || block.startsWith("[")) {
        content = block;
        break;
      }
    }
  }

  // Only clean up if content doesn't start with { or [
  // The cleanup regexes were too aggressive and broke nested JSON
  if (!content.startsWith("{") && !content.startsWith("[")) {
    // Try to find the start of JSON
    const jsonStart = content.search(/[\{\[]/);
    if (jsonStart > 0) {
      content = content.substring(jsonStart);
    }
  }
  content = content.trim();

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch (error) {
    console.error("[Parser] Failed to parse JSON:", error);
    console.error("[Parser] Content:", content.substring(0, 200) + "...");
    return null;
  }
}

/**
 * Extract codes from a response value
 * Handles both single string codes and arrays of codes
 */
export function extractCodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

/**
 * Flatten nested code arrays
 */
export function flattenCodes(codes: Array<string | string[]>): string[] {
  const result: string[] = [];
  for (const code of codes) {
    if (Array.isArray(code)) {
      result.push(...code.map(String));
    } else {
      result.push(String(code));
    }
  }
  return result;
}

/**
 * Sanitize code/theme text
 */
export function sanitizeText(text: string): string {
  return text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}
