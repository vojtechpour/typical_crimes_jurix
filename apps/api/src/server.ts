/**
 * Crime Themes Explorer - API Server
 * Express backend with WebSocket support for real-time updates
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import {
  createAIClient,
  createPhase2Analysis,
  createPhase3Analysis,
  createPhase4Analysis,
} from '@crime-themes/ai-analysis';
import type { AIProvider } from '@crime-themes/shared';

// ============================================
// Configuration
// ============================================

const PORT = process.env['PORT'] || 9000;
// Resolve data directories relative to the monorepo root (2 levels up from apps/api/src)
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = process.env['DATA_DIR'] || path.resolve(PROJECT_ROOT, 'data');
const UPLOADS_DIR = process.env['UPLOADS_DIR'] || path.resolve(PROJECT_ROOT, 'uploads');

// Ensure directories exist
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  // Directories may already exist
}

// ============================================
// Express App Setup
// ============================================

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `uploaded_${timestamp}_${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ============================================
// WebSocket
// ============================================

function broadcast(message: unknown) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ============================================
// Utility Functions
// ============================================

function resolveUploadsPath(filename: string): string {
  const resolved = path.resolve(UPLOADS_DIR, filename);
  const relative = path.relative(UPLOADS_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid path traversal attempt');
  }
  return resolved;
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ============================================
// AI Client Setup
// ============================================

let aiClient: ReturnType<typeof createAIClient> | null = null;

function getAIClient() {
  if (!aiClient) {
    aiClient = createAIClient();
  }
  return aiClient;
}

function getProviderFromModel(model?: string): AIProvider {
  if (!model) return 'gemini';
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('claude')) return 'claude';
  return 'gemini';
}

// ============================================
// Active Processes Tracking
// ============================================

interface ActiveProcess {
  type: 'p2' | 'p3' | 'p4';
  startTime: Date;
  aborted: boolean;
}

const activeProcesses = new Map<string, ActiveProcess>();

// ============================================
// API Routes
// ============================================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get list of data files
app.get('/api/data-files', (_req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json([]);
    }

    const files = fs
      .readdirSync(UPLOADS_DIR)
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, file));
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: path.join(UPLOADS_DIR, file),
        };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// Get data file content with pagination
app.get('/api/data/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { page = '1', limit = '50', search = '' } = req.query;

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 50, 1);
    const searchTerm = String(search || '').toLowerCase();

    let items = Array.isArray(data)
      ? data
      : Object.entries(data).map(([id, item]) => ({ id, ...(item as object) }));

    if (searchTerm) {
      items = items.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(searchTerm)
      );
    }

    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = items.slice(startIndex, startIndex + limitNum);

    res.json({
      items: paginatedItems,
      total: items.length,
      page: pageNum,
      totalPages: Math.ceil(items.length / limitNum),
      hasMore: startIndex + limitNum < items.length,
    });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// Upload data file
app.post('/api/upload-data', upload.single('dataFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const data = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));

    if (typeof data !== 'object' || Array.isArray(data)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'JSON must be an object, not an array' });
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      totalCases: Object.keys(data).length,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: toError(error) });
  }
});

// Delete data file
app.delete('/api/data/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = resolveUploadsPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: `File ${filename} deleted` });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// Get existing codes from a file
app.get('/api/data/:filename/codes', (req, res) => {
  try {
    const { filename } = req.params;
    const { limit = '50' } = req.query;

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, Record<string, unknown>>;
    const limitNum = Math.max(Number(limit) || 50, 1);

    const casesWithCodes: Array<{
      caseId: string;
      codes: unknown;
      caseText: string;
      timestamp: string;
    }> = [];

    for (const [caseId, caseData] of Object.entries(data)) {
      if (caseData['initial_code_0']) {
        casesWithCodes.push({
          caseId,
          codes: caseData['initial_code_0'],
          caseText: String(caseData['plny_skutek_short'] || caseData['plny_skutek'] || ''),
          timestamp: new Date().toISOString(),
        });
      }
    }

    casesWithCodes.sort((a, b) => a.caseId.localeCompare(b.caseId));

    const allCodes: string[] = [];
    for (const c of casesWithCodes) {
      if (Array.isArray(c.codes)) {
        allCodes.push(...c.codes.map(String));
      } else {
        allCodes.push(String(c.codes));
      }
    }

    res.json({
      cases: casesWithCodes.slice(0, limitNum),
      statistics: {
        totalCases: Object.keys(data).length,
        processedCases: casesWithCodes.length,
        uniqueCodesCount: new Set(allCodes).size,
        remainingCases: Object.keys(data).length - casesWithCodes.length,
        percentage: Object.keys(data).length > 0
          ? ((casesWithCodes.length / Object.keys(data).length) * 100).toFixed(1)
          : '0',
      },
    });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// ============================================
// Phase 2 API Routes
// ============================================

app.get('/api/script/status', (_req, res) => {
  const isRunning = activeProcesses.has('analysis_p2');
  res.json({
    running: isRunning,
    processId: isRunning ? 'analysis_p2' : null,
  });
});

app.post('/api/script/execute', async (req, res) => {
  const processId = 'analysis_p2';

  if (activeProcesses.has(processId)) {
    return res.status(409).json({ error: 'Script is already running', processId });
  }

  try {
    const { dataFile, globalInstructions, model } = req.body;
    const provider = getProviderFromModel(model);

    const filePath = dataFile?.startsWith('uploaded_')
      ? path.join(UPLOADS_DIR, dataFile)
      : path.join(DATA_DIR, dataFile || 'default.json');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Data file not found' });
    }

    activeProcesses.set(processId, {
      type: 'p2',
      startTime: new Date(),
      aborted: false,
    });

    broadcast({
      type: 'script_started',
      processId,
      dataFile,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, processId, message: 'Script execution started' });

    // Run analysis in background
    runPhase2Analysis(filePath, globalInstructions, provider, processId);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

async function runPhase2Analysis(
  filePath: string,
  globalInstructions: string | undefined,
  provider: AIProvider,
  processId: string
) {
  try {
    const client = getAIClient();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, Record<string, unknown>>;

    // Get existing codes
    const existingCodes: string[] = [];
    for (const caseData of Object.values(data)) {
      if (caseData['initial_code_0']) {
        const codes = caseData['initial_code_0'];
        if (Array.isArray(codes)) {
          existingCodes.push(...codes.map(String));
        } else {
          existingCodes.push(String(codes));
        }
      }
    }

    const phase2 = createPhase2Analysis(client, {}, (update) => {
      broadcast({
        type: 'progressUpdate',
        data: update,
        timestamp: new Date().toISOString(),
      });
    });

    phase2.setExistingCodes(existingCodes);

    // Process unprocessed cases
    const casesToProcess = Object.entries(data)
      .filter(([_, caseData]) => !caseData['initial_code_0'])
      .map(([id, caseData]) => ({
        id,
        text: String(caseData['plny_skutek_short'] || caseData['plny_skutek'] || ''),
      }));

    for (const caseData of casesToProcess) {
      const process = activeProcesses.get(processId);
      if (!process || process.aborted) {
        break;
      }

      const result = await phase2.analyzeCase(
        caseData.id,
        caseData.text,
        globalInstructions,
        provider
      );

      if (result.success) {
        data[caseData.id]!['initial_code_0'] = result.codes;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
    }

    broadcast({
      type: 'script_completed',
      processId,
      exitCode: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    broadcast({
      type: 'script_error',
      processId,
      data: toError(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeProcesses.delete(processId);
  }
}

app.post('/api/script/stop', (req, res) => {
  const processId = 'analysis_p2';
  const process = activeProcesses.get(processId);

  if (!process) {
    return res.status(404).json({ error: 'No running process found' });
  }

  process.aborted = true;
  activeProcesses.delete(processId);

  broadcast({
    type: 'script_stopped',
    processId,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: 'Script stopped' });
});

// ============================================
// Phase 3 API Routes
// ============================================

app.get('/api/p3/status', (_req, res) => {
  const isRunning = activeProcesses.has('analysis_p3');
  res.json({ running: isRunning, pid: null });
});

app.post('/api/p3/execute', async (req, res) => {
  const processId = 'analysis_p3';

  if (activeProcesses.has(processId)) {
    return res.status(400).json({ error: 'P3 script is already running' });
  }

  try {
    const { dataFile, model } = req.body;
    const provider = getProviderFromModel(model);

    if (!dataFile) {
      return res.status(400).json({ error: 'Data file is required' });
    }

    const filePath = dataFile.startsWith('uploaded_')
      ? path.join(UPLOADS_DIR, dataFile)
      : path.join(DATA_DIR, dataFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Data file not found' });
    }

    activeProcesses.set(processId, {
      type: 'p3',
      startTime: new Date(),
      aborted: false,
    });

    broadcast({
      type: 'p3_script_started',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'P3 analysis started', dataFile });

    // Run in background
    runPhase3Analysis(filePath, provider, processId);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

async function runPhase3Analysis(filePath: string, provider: AIProvider, processId: string) {
  try {
    const client = getAIClient();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, Record<string, unknown>>;

    const phase3 = createPhase3Analysis(client, {}, (progress) => {
      broadcast({
        type: 'p3ProgressUpdate',
        data: progress,
        timestamp: new Date().toISOString(),
      });
    });

    // Get cases with codes but no theme
    const casesToProcess = Object.entries(data)
      .filter(([_, caseData]) => caseData['initial_code_0'] && !caseData['candidate_theme'])
      .map(([id, caseData]) => ({
        id,
        codes: caseData['initial_code_0'] as string | string[],
      }));

    // Set existing themes
    const existingThemes = Object.values(data)
      .map((c) => c['candidate_theme'])
      .filter(Boolean) as string[];
    phase3.setExistingThemes(existingThemes);

    for (const caseData of casesToProcess) {
      const process = activeProcesses.get(processId);
      if (!process || process.aborted) break;

      const result = await phase3.analyzeCase(caseData.id, caseData.codes, undefined, provider);

      if (result.success) {
        data[caseData.id]!['candidate_theme'] = result.candidateTheme;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
    }

    broadcast({
      type: 'p3_script_finished',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    broadcast({
      type: 'p3_script_error',
      data: toError(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeProcesses.delete(processId);
  }
}

app.post('/api/p3/stop', (_req, res) => {
  const processId = 'analysis_p3';
  const process = activeProcesses.get(processId);

  if (!process) {
    return res.status(400).json({ error: 'No P3 script is running' });
  }

  process.aborted = true;
  activeProcesses.delete(processId);

  broadcast({
    type: 'p3_scripts_stopped',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: 'P3 script stopped' });
});

// ============================================
// Phase 4 API Routes
// ============================================

app.get('/api/p4/status', (_req, res) => {
  const isRunning = activeProcesses.has('analysis_p4');
  res.json({ running: isRunning, pid: null });
});

app.post('/api/p4/execute', async (req, res) => {
  const processId = 'analysis_p4';

  if (activeProcesses.has(processId)) {
    return res.status(400).json({ error: 'P4 script is already running' });
  }

  try {
    const { dataFile, model, themesFile } = req.body;
    const provider = getProviderFromModel(model);

    const filePath = dataFile?.startsWith('uploaded_')
      ? path.join(UPLOADS_DIR, dataFile)
      : path.join(DATA_DIR, dataFile || 'default.json');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Data file not found' });
    }

    activeProcesses.set(processId, {
      type: 'p4',
      startTime: new Date(),
      aborted: false,
    });

    broadcast({
      type: 'p4_script_started',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'P4 started' });

    // Run in background
    runPhase4Analysis(filePath, themesFile, provider, processId);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

async function runPhase4Analysis(
  filePath: string,
  themesFile: string | undefined,
  provider: AIProvider,
  processId: string
) {
  try {
    const client = getAIClient();
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, Record<string, unknown>>;

    // Get finalized themes
    let finalizedThemes: string[] = [];
    if (themesFile && fs.existsSync(themesFile)) {
      const themesData = JSON.parse(fs.readFileSync(themesFile, 'utf8'));
      finalizedThemes = Array.isArray(themesData) ? themesData : Object.keys(themesData);
    } else {
      // Extract unique candidate themes
      finalizedThemes = [...new Set(
        Object.values(data)
          .map((c) => c['candidate_theme'] || c['theme'])
          .filter(Boolean) as string[]
      )];
    }

    const phase4 = createPhase4Analysis(client, {}, (progress) => {
      broadcast({
        type: 'p4ProgressUpdate',
        data: progress,
        timestamp: new Date().toISOString(),
      });
    });

    phase4.setFinalizedThemes(finalizedThemes);

    // Get cases to process
    const casesToProcess = Object.entries(data)
      .filter(([_, caseData]) => !caseData['theme'])
      .map(([id, caseData]) => ({
        id,
        text: String(caseData['plny_skutek_short'] || caseData['plny_skutek'] || ''),
        codes: caseData['initial_code_0'] as string | string[] | undefined,
      }));

    for (const caseData of casesToProcess) {
      const process = activeProcesses.get(processId);
      if (!process || process.aborted) break;

      const result = await phase4.assignTheme(caseData.id, caseData.text, caseData.codes, provider);

      if (result.success) {
        data[caseData.id]!['theme'] = result.assignedTheme;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      }
    }

    broadcast({
      type: 'p4_script_finished',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    broadcast({
      type: 'p4_script_error',
      data: toError(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeProcesses.delete(processId);
  }
}

app.post('/api/p4/stop', (_req, res) => {
  const processId = 'analysis_p4';
  const process = activeProcesses.get(processId);

  if (!process) {
    return res.status(400).json({ error: 'No P4 script is running' });
  }

  process.aborted = true;
  activeProcesses.delete(processId);

  broadcast({
    type: 'p4_script_stopped',
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true });
});

// ============================================
// Static file serving (for production)
// ============================================

const webDistPath = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
}

// ============================================
// Start Server
// ============================================

server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}`);
  console.log(`[Server] Data directory: ${DATA_DIR}`);
  console.log(`[Server] Uploads directory: ${UPLOADS_DIR}`);
});

