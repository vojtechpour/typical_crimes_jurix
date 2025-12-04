// ============================================
// AI Provider Constants
// ============================================

export const DEFAULT_OPENAI_MODEL = 'gpt-4o';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export const AI_PROVIDER_MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
} as const;

// ============================================
// Analysis Constants
// ============================================

export const DEFAULT_TEMPERATURE = 1;
export const DEFAULT_MAX_TOKENS = 2000;
export const DEFAULT_TOP_P = 1;
export const PROMPT_TOKEN_LIMIT = 40000;

// ============================================
// Server Constants
// ============================================

export const DEFAULT_API_PORT = 9000;
export const DEFAULT_WEB_PORT = 3005;

export const UPLOADS_DIR = 'uploads';
export const DATA_DIR = 'data';

// ============================================
// File Size Limits
// ============================================

export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

