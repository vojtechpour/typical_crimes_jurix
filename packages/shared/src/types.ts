// ============================================
// AI Provider Types
// ============================================

export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface AIAnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
  config?: Partial<AIProviderConfig>;
}

export interface AIAnalysisResponse {
  content: string;
  provider: AIProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ============================================
// Crime Case Types
// ============================================

export interface CrimeCase {
  id: string;
  plny_skutek?: string;
  plny_skutek_short?: string;
  initial_code_0?: string | string[];
  candidate_theme?: string;
  theme?: string;
  [key: string]: unknown;
}

export interface CrimeCaseWithCodes extends CrimeCase {
  initial_code_0: string | string[];
}

export interface CrimeCaseWithTheme extends CrimeCase {
  candidate_theme?: string;
  theme?: string;
}

// ============================================
// Data File Types
// ============================================

export interface DataFile {
  name: string;
  size: number;
  modified: Date | string;
  path: string;
}

export interface DataFileContent {
  items: CrimeCase[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CodesStatistics {
  totalCases: number;
  processedCases: number;
  uniqueCodesCount: number;
  remainingCases: number;
  percentage: string;
}

export interface CodesResponse {
  cases: Array<{
    caseId: string;
    codes: string | string[];
    caseText: string;
    timestamp: string;
  }>;
  statistics: CodesStatistics;
}

// ============================================
// Phase 2 (Initial Codes) Types
// ============================================

export interface Phase2Progress {
  processed: number;
  total: number;
  percentage: number;
  uniqueCodes: number;
  caseText?: string;
}

export interface Phase2ProgressUpdate {
  type: 'case_completed';
  caseId: string;
  codes: string | string[];
  progress: Phase2Progress;
  timestamp: string;
}

export interface Phase2PhaseUpdate {
  type: 'phase_change';
  phase: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// ============================================
// Phase 3 (Candidate Themes) Types
// ============================================

export interface Phase3Progress {
  current: number;
  total: number;
  percentage: number;
}

export interface Phase3ProgressUpdate {
  type: 'p3_progress';
  caseId?: string;
  theme?: string;
  progress: Phase3Progress;
  timestamp: string;
}

// ============================================
// Phase 4 (Assign Themes) Types
// ============================================

export interface Phase4Progress {
  current: number;
  total: number;
  percentage: number;
  assignedThemes: number;
}

// ============================================
// WebSocket Message Types
// ============================================

export type WSMessageType =
  | 'script_started'
  | 'script_completed'
  | 'script_stopped'
  | 'script_error'
  | 'output'
  | 'progressUpdate'
  | 'phaseUpdate'
  | 'bulkProgressUpdate'
  | 'p3_script_started'
  | 'p3_script_stopped'
  | 'p3_script_error'
  | 'p3ProgressUpdate'
  | 'p3PhaseUpdate'
  | 'p3_completed_starting_p3b'
  | 'p3b_script_started'
  | 'p3b_output'
  | 'p3b_script_error'
  | 'p3b_script_finished'
  | 'p3b_script_failed'
  | 'p4_script_started'
  | 'p4_script_stopped'
  | 'p4_script_error'
  | 'p4ProgressUpdate'
  | 'p4PhaseUpdate'
  | 'p4_script_finished'
  | 'p4_script_failed'
  | 'p4_output';

export interface WSMessage {
  type: WSMessageType;
  data?: unknown;
  text?: string;
  timestamp?: string;
  processId?: string;
  exitCode?: number;
  duration?: number;
  level?: 'info' | 'warn' | 'error';
}

// ============================================
// API Response Types
// ============================================

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ScriptStatusResponse {
  running: boolean;
  processId?: string | null;
  pid?: number;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  filename: string;
  originalName: string;
  size: number;
  totalCases: number;
}



