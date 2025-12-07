/**
 * Crime Themes Explorer - API Server
 * Express backend with WebSocket support for real-time updates
 */

import path from "path";
import { fileURLToPath } from "url";

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (3 levels up from src/server.ts)
import dotenv from "dotenv";
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import {
  createAIClient,
  createPhase2Analysis,
  createPhase3Analysis,
  createPhase4Analysis,
  parseJsonResponse,
} from "@crime-themes/ai-analysis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider } from "@crime-themes/shared";

// ============================================
// Configuration
// ============================================

const PORT = process.env["PORT"] || 9000;

// Detect if running on Azure App Service (Azure sets WEBSITE_INSTANCE_ID)
const isAzure = !!process.env["WEBSITE_INSTANCE_ID"];

// On Azure, use persistent /home directory; locally, use project-relative paths
const DATA_DIR =
  process.env["DATA_DIR"] ||
  (isAzure ? "/home/data" : path.resolve(PROJECT_ROOT, "data"));
const UPLOADS_DIR =
  process.env["UPLOADS_DIR"] ||
  (isAzure ? "/home/uploads" : path.resolve(PROJECT_ROOT, "uploads"));

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
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    cb(null, `uploaded_${timestamp}_${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === "application/json" ||
      file.originalname.endsWith(".json")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only JSON files are allowed"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ============================================
// WebSocket
// ============================================

function broadcast(message: unknown) {
  const data = JSON.stringify(message);
  const msgType = (message as { type?: string })?.type || "unknown";
  console.log(`[Broadcast] Sending ${msgType} to ${wss.clients.size} clients`);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");
  ws.on("close", () => console.log("[WS] Client disconnected"));
});

// ============================================
// Utility Functions
// ============================================

function resolveUploadsPath(filename: string): string {
  const resolved = path.resolve(UPLOADS_DIR, filename);
  const relative = path.relative(UPLOADS_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid path traversal attempt");
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
  if (!model) return "gemini";
  if (model.startsWith("gpt-")) return "openai";
  if (model.startsWith("claude")) return "claude";
  return "gemini";
}

// ============================================
// Active Processes Tracking
// ============================================

interface ActiveProcess {
  type: "p2" | "p3" | "p4";
  startTime: Date;
  aborted: boolean;
}

const activeProcesses = new Map<string, ActiveProcess>();

// ============================================
// API Routes
// ============================================

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Debug single case analysis - with raw response
app.post("/api/debug/analyze-case", async (req, res) => {
  try {
    const { caseId, caseText } = req.body;
    console.log("[Debug Analyze] Starting single case analysis:", {
      caseId,
      caseTextLength: caseText?.length,
    });

    const client = getAIClient();

    // First, let's see what the raw AI response looks like
    const SYSTEM_PROMPT = `You are an expert qualitative researcher. Generate initial codes for crime case descriptions.
Respond in JSON format with the case ID as the key and the code(s) as the value.
Example: {"12345": "theft of bicycle"}
Or for multiple codes: {"12345": ["theft of bicycle", "unlocked property"]}`;

    const userPrompt = `Generate initial codes for this case and respond in JSON format.

DATA TO ANALYZE:
ID: ${caseId}
${caseText}`;

    console.log("[Debug Analyze] Calling AI directly...");
    const rawResponse = await client.analyze(SYSTEM_PROMPT, userPrompt, {
      provider: "gemini",
    });
    console.log("[Debug Analyze] Raw AI response:", rawResponse.content);

    // Inline parsing to debug
    let content = rawResponse.content.trim();
    console.log("[Debug Analyze] Raw content:", content);

    // Handle markdown JSON code blocks
    if (content.includes("```json")) {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/);
      console.log("[Debug Analyze] Regex match:", match);
      if (match?.[1]) {
        content = match[1].trim();
      }
    }
    console.log("[Debug Analyze] After extraction:", content);

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(content);
      console.log("[Debug Analyze] JSON.parse succeeded:", parsed);
    } catch (parseError) {
      console.log("[Debug Analyze] JSON.parse failed:", parseError);
    }

    // Also try the imported function
    const parsedFromImport = parseJsonResponse(rawResponse.content);
    console.log("[Debug Analyze] parseJsonResponse result:", parsedFromImport);

    res.json({
      success: true,
      rawResponse: rawResponse.content,
      extractedContent: content,
      parsed,
      parsedFromImport,
      caseIdFound: parsed ? caseId in parsed : false,
      parsedKeys: parsed ? Object.keys(parsed) : [],
    });
  } catch (error) {
    console.error("[Debug Analyze] ERROR:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Debug AI client
app.get("/api/debug/ai-test", async (_req, res) => {
  try {
    console.log("[Debug AI] Testing AI client...");
    console.log("[Debug AI] ENV vars:", {
      hasGemini: !!process.env["GEMINI_API_KEY"],
      hasOpenAI: !!process.env["OPENAI_API_KEY"],
      hasClaude: !!process.env["ANTHROPIC_API_KEY"],
    });

    const client = getAIClient();
    console.log("[Debug AI] AI client created");
    console.log("[Debug AI] Default provider:", client.getDefaultProvider());
    console.log("[Debug AI] Has Gemini:", client.hasProvider("gemini"));

    const testResponse = await client.analyze(
      "You are a helpful assistant.",
      'Say \'Hello, test successful!\' in JSON format: {"message": "..."}',
      { provider: "gemini" }
    );

    console.log("[Debug AI] Response:", testResponse);
    res.json({
      success: true,
      response: testResponse,
      providers: {
        gemini: client.hasProvider("gemini"),
        openai: client.hasProvider("openai"),
        claude: client.hasProvider("claude"),
      },
    });
  } catch (error) {
    console.error("[Debug AI] ERROR:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// Storage info (helpful for debugging deployment)
app.get("/api/storage-info", (_req, res) => {
  try {
    const dataFiles = fs.existsSync(DATA_DIR)
      ? fs.readdirSync(DATA_DIR).length
      : 0;
    const uploadFiles = fs.existsSync(UPLOADS_DIR)
      ? fs.readdirSync(UPLOADS_DIR).length
      : 0;

    res.json({
      environment: isAzure ? "azure" : "local",
      dataDir: DATA_DIR,
      uploadsDir: UPLOADS_DIR,
      dataFilesCount: dataFiles,
      uploadFilesCount: uploadFiles,
      note: isAzure
        ? "Using Azure persistent /home storage - data survives restarts"
        : "Using local filesystem - for development only",
    });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// Get list of data files
app.get("/api/data-files", (_req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json([]);
    }

    const files = fs
      .readdirSync(UPLOADS_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const stats = fs.statSync(path.join(UPLOADS_DIR, file));
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: path.join(UPLOADS_DIR, file),
        };
      })
      .sort(
        (a, b) =>
          new Date(b.modified).getTime() - new Date(a.modified).getTime()
      );

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// Get data file content with pagination
app.get("/api/data/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const { page = "1", limit = "50", search = "" } = req.query;

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.max(Number(limit) || 50, 1);
    const searchTerm = String(search || "").toLowerCase();

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
app.post("/api/upload-data", upload.single("dataFile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const data = JSON.parse(fs.readFileSync(req.file.path, "utf8"));

    if (typeof data !== "object" || Array.isArray(data)) {
      fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ error: "JSON must be an object, not an array" });
    }

    res.json({
      success: true,
      message: "File uploaded successfully",
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
app.delete("/api/data/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = resolveUploadsPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: `File ${filename} deleted` });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// ============================================
// Mockup Data Generation
// ============================================

app.post("/api/generate-mockup", async (req, res) => {
  try {
    const { prompt, model, count, filename } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const caseCount = Math.min(100, Math.max(5, Number(count) || 10));
    const provider = getProviderFromModel(model);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const baseFilename = filename?.trim() || `mockup_${timestamp}`;
    const finalFilename = baseFilename.endsWith(".json")
      ? baseFilename
      : `${baseFilename}.json`;
    const filePath = path.join(UPLOADS_DIR, finalFilename);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return res.status(409).json({
        error: `File ${finalFilename} already exists. Please choose a different name.`,
      });
    }

    const client = getAIClient();

    // System prompt for generating mockup data
    const systemPrompt = `You are a data generation assistant. Your task is to generate realistic mockup case data based on the user's description.

Generate exactly ${caseCount} unique cases. Each case should have realistic, detailed descriptions that could be used for analysis.

IMPORTANT: Respond ONLY with a valid JSON array. No explanations, no markdown, just the raw JSON.

The JSON format should be:
[
  {
    "id": "case_001",
    "plny_skutek_short": "Detailed case description here..."
  },
  {
    "id": "case_002",
    "plny_skutek_short": "Another detailed case description..."
  }
]

Requirements:
- Each case must have a unique id (case_001, case_002, etc.)
- Each plny_skutek_short should be 100-300 words with specific details
- Make each case unique with different circumstances, locations, times, and details
- Include realistic details that would be present in actual case reports
- Vary the scenarios while staying within the described domain`;

    const userPrompt = `Generate ${caseCount} cases for the following domain:\n\n${prompt.trim()}`;

    // Call AI to generate cases
    const response = await client.analyze(systemPrompt, userPrompt, {
      provider,
      model,
    });

    // Parse the response
    let cases: Array<{ id: string; plny_skutek_short: string }>;
    try {
      // Try to extract JSON from the response (handle markdown code blocks if present)
      let jsonContent = response.content.trim();

      // Remove markdown code blocks if present
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(jsonContent);

      if (Array.isArray(parsed)) {
        cases = parsed;
      } else if (typeof parsed === "object") {
        // Handle object format (convert to array)
        cases = Object.entries(parsed).map(([id, data]) => ({
          id,
          ...(data as object),
        })) as Array<{ id: string; plny_skutek_short: string }>;
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (parseError) {
      console.error("[Mockup] Failed to parse AI response:", response.content);
      return res.status(500).json({
        error: "Failed to parse AI response. Please try again.",
      });
    }

    // Validate and normalize cases
    const validCases = cases
      .filter((c) => c && c.plny_skutek_short)
      .map((c, index) => ({
        id: c.id || `case_${String(index + 1).padStart(3, "0")}`,
        plny_skutek_short: String(c.plny_skutek_short).trim(),
      }));

    if (validCases.length === 0) {
      return res.status(500).json({
        error: "AI failed to generate valid cases. Please try again.",
      });
    }

    // Convert array to object format (matching existing data format)
    const dataObject: Record<
      string,
      { id: string; plny_skutek_short: string }
    > = {};
    for (const caseItem of validCases) {
      dataObject[caseItem.id] = caseItem;
    }

    // Save to file
    fs.writeFileSync(filePath, JSON.stringify(dataObject, null, 2), "utf8");

    res.json({
      success: true,
      filename: finalFilename,
      cases: validCases,
      totalCases: validCases.length,
      provider,
      model,
    });
  } catch (error) {
    console.error("[Mockup] Generation error:", error);
    res.status(500).json({ error: toError(error) });
  }
});

// ============================================
// AI Theme Tools - Function Calling Endpoint
// ============================================

// Theme tool function declarations for Gemini/Claude
const themeToolDeclarations = [
  {
    name: "move_theme",
    description: "Moves a candidate theme from one theme group to another",
    parameters: {
      type: "object",
      properties: {
        candidateTheme: {
          type: "string",
          description: "The candidate theme to move",
        },
        fromGroup: {
          type: "string",
          description: "Source theme group name",
        },
        toGroup: {
          type: "string",
          description: "Destination theme group name",
        },
      },
      required: ["candidateTheme", "fromGroup", "toGroup"],
    },
  },
  {
    name: "merge_themes",
    description: "Merges two candidate themes into one with a new name",
    parameters: {
      type: "object",
      properties: {
        theme1: { type: "string", description: "First theme to merge" },
        theme2: { type: "string", description: "Second theme to merge" },
        newName: { type: "string", description: "Name for the merged theme" },
      },
      required: ["theme1", "theme2", "newName"],
    },
  },
  {
    name: "rename_theme",
    description: "Renames a theme group or candidate theme",
    parameters: {
      type: "object",
      properties: {
        oldName: { type: "string", description: "Current name of the theme" },
        newName: { type: "string", description: "New name for the theme" },
        themeType: {
          type: "string",
          enum: ["group", "candidate"],
          description:
            "Type of theme: 'group' for theme groups, 'candidate' for candidate themes",
        },
      },
      required: ["oldName", "newName", "themeType"],
    },
  },
  {
    name: "create_theme_group",
    description:
      "Creates a new theme group/category to organize candidate themes",
    parameters: {
      type: "object",
      properties: {
        groupName: {
          type: "string",
          description: "Name for the new theme group",
        },
      },
      required: ["groupName"],
    },
  },
  {
    name: "delete_theme",
    description: "Deletes a candidate theme or theme group",
    parameters: {
      type: "object",
      properties: {
        themeName: {
          type: "string",
          description: "Name of the theme to delete",
        },
        themeType: {
          type: "string",
          enum: ["group", "candidate"],
          description:
            "Type of theme: 'group' for theme groups, 'candidate' for candidate themes",
        },
      },
      required: ["themeName", "themeType"],
    },
  },
];

app.post("/api/ai-theme-tools", async (req, res) => {
  try {
    const { prompt, model, themeData, conversationHistory } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const modelToUse = model || "gemini-3-pro-preview";
    console.log(`[AI Theme Tools] Using model: ${modelToUse}`);

    // Build system prompt with theme context
    const systemPrompt = `You are an AI assistant helping to organize crime themes.
You have access to tools that can manipulate themes: move_theme, merge_themes, rename_theme, create_theme_group, and delete_theme.

Current theme data:
${JSON.stringify(themeData || {}, null, 2)}

When suggesting changes, always explain your reasoning clearly using markdown formatting.
Use bullet points, bold text, and clear structure to make your suggestions easy to understand.
If you want to execute a tool, ask the user first if they'd like you to proceed.
When the user confirms, then call the appropriate tool(s).

Be conversational and helpful. Ask clarifying questions if needed.`;

    if (modelToUse.startsWith("gemini")) {
      // Use Gemini with function calling
      const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] || "");

      const geminiModel = genAI.getGenerativeModel({
        model: modelToUse,
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: themeToolDeclarations }],
      });

      // Build conversation history for multi-turn chat
      const contents: Array<{
        role: "user" | "model";
        parts: Array<{ text: string }>;
      }> = [];

      if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory) {
          if (msg.role === "user") {
            contents.push({
              role: "user",
              parts: [{ text: msg.content }],
            });
          } else if (msg.role === "assistant" && msg.content) {
            contents.push({
              role: "model",
              parts: [{ text: msg.content }],
            });
          }
        }
      }

      // Add the current prompt
      contents.push({
        role: "user",
        parts: [{ text: prompt }],
      });

      const result = await geminiModel.generateContent({ contents });
      const response = result.response;

      // Extract both function calls AND text responses from the response
      const functionCalls: Array<{
        name: string;
        args: Record<string, unknown>;
      }> = [];
      const textParts: string[] = [];

      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args as Record<string, unknown>,
            });
          }
          if (part.text) {
            textParts.push(part.text);
          }
        }
      }

      // Return both text commentary and function calls
      res.json({
        success: true,
        functionCalls,
        textResponse: textParts.length > 0 ? textParts.join("\n") : null,
      });
    } else if (modelToUse.startsWith("claude")) {
      // Use Claude with tool use
      const anthropic = new Anthropic({
        apiKey: process.env["ANTHROPIC_API_KEY"],
      });

      // Convert to Claude tool format
      const claudeTools = themeToolDeclarations.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));

      // Build conversation history for Claude
      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];

      if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory) {
          if (msg.role === "user") {
            messages.push({ role: "user", content: msg.content });
          } else if (msg.role === "assistant" && msg.content) {
            messages.push({ role: "assistant", content: msg.content });
          }
        }
      }

      // Add current prompt
      messages.push({ role: "user", content: prompt });

      const response = await anthropic.messages.create({
        model: modelToUse,
        max_tokens: 1024,
        system: systemPrompt,
        tools: claudeTools,
        messages,
      });

      // Extract both function calls AND text responses from Claude
      const functionCalls: Array<{
        name: string;
        args: Record<string, unknown>;
      }> = [];
      const textParts: string[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          functionCalls.push({
            name: block.name,
            args: block.input as Record<string, unknown>,
          });
        } else if (block.type === "text" && block.text) {
          textParts.push(block.text);
        }
      }

      res.json({
        success: true,
        functionCalls,
        textResponse: textParts.length > 0 ? textParts.join("\n") : null,
      });
    } else {
      return res.status(400).json({
        error: `Unsupported model: ${modelToUse}. Use gemini-3-pro-preview, gemini-2.5-flash, or claude-sonnet-4-5-20250929`,
      });
    }
  } catch (error) {
    console.error("[AI Theme Tools] Error:", error);
    res.status(500).json({ error: toError(error) });
  }
});

// Get existing codes from a file
app.get("/api/data/:filename/codes", (req, res) => {
  try {
    const { filename } = req.params;
    const { limit = "50" } = req.query;

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
    const limitNum = Math.max(Number(limit) || 50, 1);

    const casesWithCodes: Array<{
      caseId: string;
      codes: unknown;
      caseText: string;
      timestamp: string;
    }> = [];

    for (const [caseId, caseData] of Object.entries(data)) {
      if (caseData["initial_code_0"]) {
        casesWithCodes.push({
          caseId,
          codes: caseData["initial_code_0"],
          caseText: String(
            caseData["plny_skutek_short"] || caseData["plny_skutek"] || ""
          ),
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
        percentage:
          Object.keys(data).length > 0
            ? (
                (casesWithCodes.length / Object.keys(data).length) *
                100
              ).toFixed(1)
            : "0",
      },
    });
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

// Delete all initial codes from a file
app.delete("/api/data/:filename/codes", (req, res) => {
  try {
    const { filename } = req.params;
    console.log("[Delete Codes] Deleting all codes from:", filename);

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

    let casesCleared = 0;
    for (const caseData of Object.values(data)) {
      if (caseData["initial_code_0"]) {
        delete caseData["initial_code_0"];
        casesCleared++;
      }
    }

    // Save the updated data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log("[Delete Codes] Cleared codes from", casesCleared, "cases");

    res.json({
      success: true,
      casesCleared,
      message: `Deleted initial codes from ${casesCleared} cases`,
    });
  } catch (error) {
    console.error("[Delete Codes] Error:", error);
    res.status(500).json({ error: toError(error) });
  }
});

// Get existing themes from a file
app.get("/api/data/:filename/themes", (req, res) => {
  try {
    const { filename } = req.params;
    const { limit = "10000" } = req.query;

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
    const limitNum = Math.max(Number(limit) || 10000, 1);

    // Extract P3b output metadata if it exists
    const p3bOutput = data["_p3b_output"] as
      | {
          finalThemes?: Array<{
            name: string;
            description: string;
            mergedFrom: string[];
          }>;
          mappings?: Record<string, string>;
          generatedAt?: string;
        }
      | undefined;

    const casesWithThemes: Array<{
      caseId: string;
      candidate_theme: string | null;
      theme: string | null;
      initialCodes: unknown;
      caseText: string;
      timestamp: string;
    }> = [];

    for (const [caseId, caseData] of Object.entries(data)) {
      // Skip metadata keys
      if (caseId.startsWith("_")) continue;

      // Include only cases that have actual themes (candidate or final)
      if (caseData["candidate_theme"] || caseData["theme"]) {
        casesWithThemes.push({
          caseId,
          candidate_theme: (caseData["candidate_theme"] as string) || null,
          theme: (caseData["theme"] as string) || null,
          initialCodes: caseData["initial_code_0"] || [],
          caseText: String(
            caseData["plny_skutek_short"] ||
              caseData["plny_skutek"] ||
              caseData["text"] ||
              ""
          ),
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Sort by caseId
    casesWithThemes.sort((a, b) => a.caseId.localeCompare(b.caseId));

    // Apply limit
    const limitedCases = casesWithThemes.slice(0, limitNum);

    const uniqueCandidateThemes = new Set(
      casesWithThemes.map((c) => c.candidate_theme).filter(Boolean)
    );
    const uniqueFinalThemes = new Set(
      casesWithThemes.map((c) => c.theme).filter(Boolean)
    );

    res.json({
      cases: limitedCases,
      statistics: {
        totalCases: Object.keys(data).filter((k) => !k.startsWith("_")).length,
        casesWithCandidateThemes: casesWithThemes.filter(
          (c) => c.candidate_theme
        ).length,
        casesWithFinalThemes: casesWithThemes.filter((c) => c.theme).length,
        uniqueCandidateThemesCount: uniqueCandidateThemes.size,
        uniqueFinalThemesCount: uniqueFinalThemes.size,
      },
      p3bOutput: p3bOutput || null,
    });
  } catch (error) {
    console.error("[Get Themes] Error:", error);
    res.status(500).json({ error: toError(error) });
  }
});

// Delete all candidate themes from a file
app.delete("/api/data/:filename/delete-all-candidate-themes", (req, res) => {
  try {
    const { filename } = req.params;
    console.log(
      "[Delete Candidate Themes] Deleting all candidate themes from:",
      filename
    );

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

    let deletedCount = 0;
    for (const caseData of Object.values(data)) {
      if (caseData["candidate_theme"]) {
        delete caseData["candidate_theme"];
        deletedCount++;
      }
    }

    // Save the updated data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(
      "[Delete Candidate Themes] Deleted candidate themes from",
      deletedCount,
      "cases"
    );

    res.json({
      success: true,
      deletedCount,
      message: `Deleted candidate themes from ${deletedCount} cases`,
    });
  } catch (error) {
    console.error("[Delete Candidate Themes] Error:", error);
    res.status(500).json({ error: toError(error) });
  }
});

// Delete all final themes from a file
app.delete("/api/data/:filename/delete-all-final-themes", (req, res) => {
  try {
    const { filename } = req.params;
    console.log(
      "[Delete Final Themes] Deleting all final themes from:",
      filename
    );

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

    let deletedCount = 0;
    for (const [caseId, caseData] of Object.entries(data)) {
      // Skip metadata keys (like _p3b_output) - only clear theme from actual cases
      if (caseId.startsWith("_")) continue;

      if (caseData["theme"]) {
        delete caseData["theme"];
        deletedCount++;
      }
    }

    // Save the updated data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(
      "[Delete Final Themes] Deleted final themes from",
      deletedCount,
      "cases"
    );

    res.json({
      success: true,
      deletedCount,
      message: `Deleted final themes from ${deletedCount} cases`,
    });
  } catch (error) {
    console.error("[Delete Final Themes] Error:", error);
    res.status(500).json({ error: toError(error) });
  }
});

// Update theme for a specific case
app.put("/api/data/:filename/case/:caseId/update-theme", (req, res) => {
  try {
    const { filename, caseId } = req.params;
    const { themeType, theme } = req.body;

    if (!themeType || !["candidate_theme", "theme"].includes(themeType)) {
      return res.status(400).json({
        error: "Invalid themeType. Must be 'candidate_theme' or 'theme'",
      });
    }

    const filePath = resolveUploadsPath(filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

    if (!data[caseId]) {
      return res.status(404).json({ error: `Case ${caseId} not found` });
    }

    // Update or delete the theme
    if (theme === null || theme === undefined || theme === "") {
      delete data[caseId][themeType];
    } else {
      data[caseId][themeType] = theme;
    }

    // Save the updated data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

    res.json({
      success: true,
      caseId,
      themeType,
      theme: theme || null,
    });
  } catch (error) {
    console.error("[Update Theme] Error:", error);
    res.status(500).json({ error: toError(error) });
  }
});

// ============================================
// Phase 2 API Routes
// ============================================

app.get("/api/script/status", (_req, res) => {
  const isRunning = activeProcesses.has("analysis_p2");
  res.json({
    running: isRunning,
    processId: isRunning ? "analysis_p2" : null,
  });
});

app.post("/api/script/execute", async (req, res) => {
  const processId = "analysis_p2";

  if (activeProcesses.has(processId)) {
    return res
      .status(409)
      .json({ error: "Script is already running", processId });
  }

  try {
    const { dataFile, globalInstructions, model } = req.body;
    const provider = getProviderFromModel(model);

    // Debug logging
    console.log("[P2 Execute] Request received:", {
      dataFile,
      model,
      hasGlobalInstructions: !!globalInstructions,
      UPLOADS_DIR,
      DATA_DIR,
    });

    // All files are now in UPLOADS_DIR
    const filePath = path.join(UPLOADS_DIR, dataFile || "default.json");

    console.log("[P2 Execute] Resolved file path:", filePath);
    console.log("[P2 Execute] File exists:", fs.existsSync(filePath));

    // List files in UPLOADS_DIR for debugging
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      console.log("[P2 Execute] Files in UPLOADS_DIR:", files);
    }

    if (!fs.existsSync(filePath)) {
      console.error("[P2 Execute] File not found at path:", filePath);
      return res
        .status(404)
        .json({ error: `Data file not found: ${dataFile}` });
    }

    activeProcesses.set(processId, {
      type: "p2",
      startTime: new Date(),
      aborted: false,
    });

    broadcast({
      type: "script_started",
      processId,
      dataFile,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, processId, message: "Script execution started" });

    // Run analysis in background
    console.log("[P2 Execute] About to start background analysis");
    runPhase2Analysis(filePath, globalInstructions, provider, processId)
      .then(() => console.log("[P2 Execute] Background analysis completed"))
      .catch((err) =>
        console.error("[P2 Execute] Background analysis failed:", err)
      );
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
  console.log("[P2 Analysis] Starting analysis:", {
    filePath,
    provider,
    processId,
  });

  try {
    const client = getAIClient();
    console.log("[P2 Analysis] AI client created");

    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
    console.log(
      "[P2 Analysis] Data loaded, total entries:",
      Object.keys(data).length
    );

    // Get existing codes
    const existingCodes: string[] = [];
    for (const caseData of Object.values(data)) {
      if (caseData["initial_code_0"]) {
        const codes = caseData["initial_code_0"];
        if (Array.isArray(codes)) {
          existingCodes.push(...codes.map(String));
        } else {
          existingCodes.push(String(codes));
        }
      }
    }
    console.log("[P2 Analysis] Existing codes count:", existingCodes.length);

    const phase2 = createPhase2Analysis(client, {}, (update) => {
      console.log("[P2 Analysis] Progress update:", update);
      broadcast({
        type: "progressUpdate",
        data: update,
        timestamp: new Date().toISOString(),
      });
    });

    phase2.setExistingCodes(existingCodes);

    // Process unprocessed cases
    const casesToProcess = Object.entries(data)
      .filter(([_, caseData]) => !caseData["initial_code_0"])
      .map(([id, caseData]) => ({
        id,
        text: String(
          caseData["plny_skutek_short"] || caseData["plny_skutek"] || ""
        ),
      }));

    const totalToProcess = casesToProcess.length;
    const alreadyProcessed = Object.keys(data).length - totalToProcess;
    const totalCases = Object.keys(data).length;

    console.log("[P2 Analysis] Cases to process:", totalToProcess);
    console.log("[P2 Analysis] Already processed:", alreadyProcessed);

    // Send initial status update
    broadcast({
      type: "progressUpdate",
      data: {
        phase: "Starting",
        case_id: null,
        codes: [],
        progress: {
          processed: alreadyProcessed,
          total: totalCases,
          remaining: totalToProcess,
          percentage:
            totalCases > 0
              ? ((alreadyProcessed / totalCases) * 100).toFixed(1)
              : "0",
          unique_codes: existingCodes.length,
        },
        message: `Starting analysis of ${totalToProcess} cases...`,
      },
      timestamp: new Date().toISOString(),
    });

    for (let i = 0; i < casesToProcess.length; i++) {
      const caseData = casesToProcess[i]!;
      const process = activeProcesses.get(processId);
      if (!process || process.aborted) {
        console.log("[P2 Analysis] Process aborted or not found");
        broadcast({
          type: "progressUpdate",
          data: {
            phase: "Stopped",
            message: "Analysis stopped by user",
          },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      console.log(
        `[P2 Analysis] Processing case ${i + 1}/${totalToProcess}:`,
        caseData.id
      );

      const result = await phase2.analyzeCase(
        caseData.id,
        caseData.text,
        globalInstructions,
        provider
      );

      console.log("[P2 Analysis] Case result:", {
        caseId: caseData.id,
        success: result.success,
        codes: result.codes,
      });

      if (result.success) {
        data[caseData.id]!["initial_code_0"] = result.codes;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

        // Send success update after completing the case
        broadcast({
          type: "progressUpdate",
          data: {
            phase: "Processing Cases",
            case_id: caseData.id,
            codes: result.codes,
            case_text: caseData.text,
            progress: {
              processed: alreadyProcessed + i + 1,
              total: totalCases,
              remaining: totalToProcess - i - 1,
              percentage:
                totalCases > 0
                  ? (((alreadyProcessed + i + 1) / totalCases) * 100).toFixed(1)
                  : "0",
              unique_codes: phase2.getUniqueCodes().length,
            },
            message: `Completed case ${caseData.id} with ${
              Array.isArray(result.codes) ? result.codes.length : 1
            } codes`,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Send error update
        broadcast({
          type: "progressUpdate",
          data: {
            phase: "Processing Cases",
            case_id: caseData.id,
            error: result.error,
            progress: {
              processed: alreadyProcessed + i + 1,
              total: totalCases,
              remaining: totalToProcess - i - 1,
              percentage:
                totalCases > 0
                  ? (((alreadyProcessed + i + 1) / totalCases) * 100).toFixed(1)
                  : "0",
              unique_codes: phase2.getUniqueCodes().length,
            },
            message: `Error processing case ${caseData.id}: ${result.error}`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    console.log("[P2 Analysis] Completed successfully");
    broadcast({
      type: "script_completed",
      processId,
      exitCode: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[P2 Analysis] ERROR:", error);
    broadcast({
      type: "script_error",
      processId,
      data: toError(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeProcesses.delete(processId);
  }
}

app.post("/api/script/stop", (req, res) => {
  const processId = "analysis_p2";
  const process = activeProcesses.get(processId);

  if (!process) {
    return res.status(404).json({ error: "No running process found" });
  }

  process.aborted = true;
  activeProcesses.delete(processId);

  broadcast({
    type: "script_stopped",
    processId,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: "Script stopped" });
});

// ============================================
// Phase 3 API Routes
// ============================================

app.get("/api/p3/status", (_req, res) => {
  const isRunning = activeProcesses.has("analysis_p3");
  res.json({ running: isRunning, pid: null });
});

app.post("/api/p3/execute", async (req, res) => {
  const processId = "analysis_p3";

  if (activeProcesses.has(processId)) {
    return res.status(400).json({ error: "P3 script is already running" });
  }

  try {
    const { dataFile, model, customInstructions } = req.body;
    const provider = getProviderFromModel(model);

    if (!dataFile) {
      return res.status(400).json({ error: "Data file is required" });
    }

    // All data files are stored in UPLOADS_DIR
    const filePath = path.join(UPLOADS_DIR, dataFile);
    console.log(
      "[P3 Execute] File path:",
      filePath,
      "exists:",
      fs.existsSync(filePath)
    );

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: `Data file not found: ${dataFile}` });
    }

    activeProcesses.set(processId, {
      type: "p3",
      startTime: new Date(),
      aborted: false,
    });

    broadcast({
      type: "p3_script_started",
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: "P3 analysis started", dataFile });

    // Run in background
    runPhase3Analysis(filePath, provider, processId, customInstructions);
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

async function runPhase3Analysis(
  filePath: string,
  provider: AIProvider,
  processId: string,
  customInstructions?: string
) {
  try {
    const client = getAIClient();
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

    const phase3 = createPhase3Analysis(client, {}, (progress) => {
      broadcast({
        type: "p3ProgressUpdate",
        data: progress,
        timestamp: new Date().toISOString(),
      });
    });

    // Get cases with codes but no theme
    const casesToProcess = Object.entries(data)
      .filter(
        ([_, caseData]) =>
          caseData["initial_code_0"] && !caseData["candidate_theme"]
      )
      .map(([id, caseData]) => ({
        id,
        codes: caseData["initial_code_0"] as string | string[],
        caseText: (caseData["text"] ||
          caseData["case_text"] ||
          caseData["plny_skutek_short"] ||
          "") as string,
      }));

    // Set existing themes
    const existingThemes = Object.values(data)
      .map((c) => c["candidate_theme"])
      .filter(Boolean) as string[];
    phase3.setExistingThemes(existingThemes);

    const totalCases = casesToProcess.length;
    const totalExisting = existingThemes.length;
    let processedCount = 0;

    // Broadcast initial status
    broadcast({
      type: "p3PhaseUpdate",
      data: {
        phase: totalCases > 0 ? "Processing" : "Complete",
        details: {
          total_cases: totalCases,
          existing_themes: totalExisting,
          message:
            totalCases > 0
              ? `Found ${totalCases} cases to process (${totalExisting} already have themes)`
              : `All ${totalExisting} cases already have candidate themes - nothing to process`,
        },
      },
      timestamp: new Date().toISOString(),
    });

    // If no cases to process, finish immediately
    if (totalCases === 0) {
      broadcast({
        type: "output",
        text: `ℹ️ All ${totalExisting} cases already have candidate themes. Nothing to process.`,
        level: "info",
        timestamp: new Date().toLocaleTimeString(),
      });
      broadcast({
        type: "p3_script_finished",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    broadcast({
      type: "output",
      text: `📊 Starting P3 analysis: ${totalCases} cases to process, ${totalExisting} already have themes`,
      level: "info",
      timestamp: new Date().toLocaleTimeString(),
    });

    if (customInstructions?.trim()) {
      broadcast({
        type: "output",
        text: `📝 Using custom instructions: "${customInstructions.trim()}"`,
        level: "info",
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    for (const caseData of casesToProcess) {
      const process = activeProcesses.get(processId);
      if (!process || process.aborted) break;

      const result = await phase3.analyzeCase(
        caseData.id,
        caseData.codes,
        customInstructions,
        provider
      );

      processedCount++;

      if (result.success) {
        data[caseData.id]!["candidate_theme"] = result.candidateTheme;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      }

      // Broadcast progress update after each case
      broadcast({
        type: "p3ProgressUpdate",
        data: {
          case_id: caseData.id,
          candidate_theme: result.candidateTheme || null,
          initial_codes: Array.isArray(caseData.codes)
            ? caseData.codes
            : [caseData.codes],
          case_text: caseData.caseText,
          success: result.success,
          error: result.error || null,
          progress: {
            processed: processedCount,
            total: totalCases,
            unique_themes: phase3.getUniqueThemes().length,
          },
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    }

    broadcast({
      type: "p3_script_finished",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    broadcast({
      type: "p3_script_error",
      data: toError(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeProcesses.delete(processId);
  }
}

app.post("/api/p3/stop", (_req, res) => {
  const processId = "analysis_p3";
  const process = activeProcesses.get(processId);

  if (!process) {
    return res.status(400).json({ error: "No P3 script is running" });
  }

  process.aborted = true;
  activeProcesses.delete(processId);

  broadcast({
    type: "p3_scripts_stopped",
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: "P3 script stopped" });
});

// ============================================
// Phase 3b API Routes (Theme Finalization)
// ============================================

app.get("/api/p3b/status", (_req, res) => {
  const isRunning = activeProcesses.has("analysis_p3b");
  res.json({ running: isRunning, pid: null });
});

app.post("/api/p3b/execute", async (req, res) => {
  const processId = "analysis_p3b";

  if (activeProcesses.has(processId)) {
    return res.status(400).json({ error: "P3b script is already running" });
  }

  try {
    const { dataFile, model, customInstructions } = req.body;
    const provider = getProviderFromModel(model);

    if (!dataFile) {
      return res.status(400).json({ error: "Data file is required" });
    }

    // All data files are stored in UPLOADS_DIR
    const filePath = path.join(UPLOADS_DIR, dataFile);
    console.log(
      "[P3b Execute] File path:",
      filePath,
      "exists:",
      fs.existsSync(filePath)
    );

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: `Data file not found: ${dataFile}` });
    }

    activeProcesses.set(processId, {
      type: "p3b",
      startTime: new Date(),
      aborted: false,
    });

    broadcast({
      type: "p3b_script_started",
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: "P3b analysis started", dataFile });

    // Run in background
    runPhase3bAnalysis(
      filePath,
      provider,
      processId,
      model,
      customInstructions
    );
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

async function runPhase3bAnalysis(
  filePath: string,
  provider: AIProvider,
  processId: string,
  model: string,
  customInstructions?: string
) {
  try {
    const client = getAIClient();
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

    // Collect all unique candidate themes
    const candidateThemes = new Set<string>();
    for (const caseData of Object.values(data)) {
      if (caseData["candidate_theme"]) {
        candidateThemes.add(caseData["candidate_theme"] as string);
      }
    }

    const candidateThemesList = Array.from(candidateThemes);

    if (candidateThemesList.length === 0) {
      broadcast({
        type: "p3b_script_failed",
        error: "No candidate themes found. Run P3 analysis first.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    broadcast({
      type: "p3b_output",
      text: `Found ${candidateThemesList.length} unique candidate themes to finalize`,
      timestamp: new Date().toLocaleTimeString(),
    });

    // Build prompt for theme finalization
    const systemPrompt = `You are an expert qualitative researcher specializing in thematic analysis of crime data.
Your task is to review candidate themes and create a refined, final set of themes.

Guidelines:
- Merge similar themes that describe the same pattern
- Create clear, descriptive theme names
- Ensure themes are mutually exclusive
- Maintain comprehensive coverage of all patterns
- Use criminological terminology where appropriate
- Each final theme should have a clear, distinct meaning

Respond ONLY with a JSON object in this exact format:
{
  "finalThemes": [
    {
      "name": "Theme Name",
      "description": "Brief description of what this theme covers",
      "mergedFrom": ["Original Theme 1", "Original Theme 2"]
    }
  ],
  "mappings": {
    "Original Candidate Theme": "Final Theme Name"
  }
}`;

    let userPrompt = `Please analyze these ${
      candidateThemesList.length
    } candidate themes and create a refined set of final themes:

${candidateThemesList.map((t, i) => `${i + 1}. ${t}`).join("\n")}
`;

    if (customInstructions?.trim()) {
      userPrompt += `
SPECIAL INSTRUCTIONS:
${customInstructions.trim()}
`;
    }

    userPrompt += `
Create a consolidated set of final themes, merging similar ones and providing clear mappings.`;

    broadcast({
      type: "p3b_output",
      text: "Analyzing candidate themes with AI...",
      timestamp: new Date().toLocaleTimeString(),
    });

    if (customInstructions?.trim()) {
      broadcast({
        type: "p3b_output",
        text: `📝 Using custom instructions: "${customInstructions.trim()}"`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    const response = await client.analyze(systemPrompt, userPrompt, {
      provider,
      model,
    });

    // Parse the response
    let finalThemesData;
    try {
      let jsonContent = response.content.trim();
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }
      finalThemesData = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("[P3b] Failed to parse AI response:", response.content);
      broadcast({
        type: "p3b_script_failed",
        error: "Failed to parse AI response",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Apply the mappings to the data file
    const mappings = finalThemesData.mappings || {};
    let updatedCount = 0;

    for (const [caseId, caseData] of Object.entries(data)) {
      const candidateTheme = caseData["candidate_theme"] as string;
      if (candidateTheme && mappings[candidateTheme]) {
        caseData["theme"] = mappings[candidateTheme];
        updatedCount++;
      }
    }

    // Store P3b output metadata in the file (so it persists even when assignments are cleared)
    (data as Record<string, unknown>)["_p3b_output"] = {
      finalThemes: finalThemesData.finalThemes,
      mappings: finalThemesData.mappings,
      generatedAt: new Date().toISOString(),
    };

    // Save the updated data
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

    broadcast({
      type: "p3b_output",
      text: `Applied theme mappings to ${updatedCount} cases`,
      timestamp: new Date().toLocaleTimeString(),
    });

    broadcast({
      type: "p3b_output",
      text: `Created ${finalThemesData.finalThemes?.length || 0} final themes`,
      timestamp: new Date().toLocaleTimeString(),
    });

    broadcast({
      type: "p3b_script_finished",
      output: JSON.stringify(finalThemesData, null, 2),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[P3b Analysis] ERROR:", error);
    broadcast({
      type: "p3b_script_error",
      data: toError(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeProcesses.delete(processId);
  }
}

app.post("/api/p3b/stop", (_req, res) => {
  const processId = "analysis_p3b";
  const process = activeProcesses.get(processId);

  if (!process) {
    return res.status(400).json({ error: "No P3b script is running" });
  }

  process.aborted = true;
  activeProcesses.delete(processId);

  broadcast({
    type: "p3b_script_stopped",
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: "P3b script stopped" });
});

// ============================================
// Phase 4 API Routes
// ============================================

app.get("/api/p4/status", (_req, res) => {
  const isRunning = activeProcesses.has("analysis_p4");
  res.json({ running: isRunning, pid: null });
});

app.post("/api/p4/execute", async (req, res) => {
  const processId = "analysis_p4";

  if (activeProcesses.has(processId)) {
    return res.status(400).json({ error: "P4 script is already running" });
  }

  try {
    const { dataFile, model, themesFile, customInstructions } = req.body;
    const provider = getProviderFromModel(model);

    // All data files are stored in UPLOADS_DIR
    const filePath = path.join(UPLOADS_DIR, dataFile || "default.json");
    console.log(
      "[P4 Execute] File path:",
      filePath,
      "exists:",
      fs.existsSync(filePath)
    );

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ error: `Data file not found: ${dataFile}` });
    }

    activeProcesses.set(processId, {
      type: "p4",
      startTime: new Date(),
      aborted: false,
    });

    broadcast({
      type: "p4_script_started",
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: "P4 started" });

    // Run in background
    runPhase4Analysis(
      filePath,
      themesFile,
      provider,
      processId,
      customInstructions
    );
  } catch (error) {
    res.status(500).json({ error: toError(error) });
  }
});

async function runPhase4Analysis(
  filePath: string,
  themesFile: string | undefined,
  provider: AIProvider,
  processId: string,
  customInstructions?: string
) {
  try {
    const client = getAIClient();
    const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;

    // Get finalized themes
    let finalizedThemes: string[] = [];
    if (themesFile && fs.existsSync(themesFile)) {
      const themesData = JSON.parse(fs.readFileSync(themesFile, "utf8"));
      finalizedThemes = Array.isArray(themesData)
        ? themesData
        : Object.keys(themesData);
    } else {
      // Extract unique candidate themes
      finalizedThemes = [
        ...new Set(
          Object.values(data)
            .map((c) => c["candidate_theme"] || c["theme"])
            .filter(Boolean) as string[]
        ),
      ];
    }

    const phase4 = createPhase4Analysis(client, {}, (progress) => {
      broadcast({
        type: "p4ProgressUpdate",
        data: progress,
        timestamp: new Date().toISOString(),
      });
    });

    phase4.setFinalizedThemes(finalizedThemes);

    // Get cases to process
    const casesToProcess = Object.entries(data)
      .filter(([_, caseData]) => !caseData["theme"])
      .map(([id, caseData]) => ({
        id,
        text: String(
          caseData["plny_skutek_short"] || caseData["plny_skutek"] || ""
        ),
        codes: caseData["initial_code_0"] as string | string[] | undefined,
      }));

    if (customInstructions?.trim()) {
      broadcast({
        type: "output",
        text: `📝 Using custom instructions: "${customInstructions.trim()}"`,
        level: "info",
        timestamp: new Date().toLocaleTimeString(),
      });
    }

    for (const caseData of casesToProcess) {
      const process = activeProcesses.get(processId);
      if (!process || process.aborted) break;

      const result = await phase4.assignTheme(
        caseData.id,
        caseData.text,
        caseData.codes,
        customInstructions,
        provider
      );

      if (result.success) {
        data[caseData.id]!["theme"] = result.assignedTheme;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
      }
    }

    broadcast({
      type: "p4_script_finished",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    broadcast({
      type: "p4_script_error",
      data: toError(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeProcesses.delete(processId);
  }
}

app.post("/api/p4/stop", (_req, res) => {
  const processId = "analysis_p4";
  const process = activeProcesses.get(processId);

  if (!process) {
    return res.status(400).json({ error: "No P4 script is running" });
  }

  process.aborted = true;
  activeProcesses.delete(processId);

  broadcast({
    type: "p4_script_stopped",
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true });
});

// ============================================
// Static file serving (for production)
// ============================================

const webDistPath = path.resolve(__dirname, "../../web/dist");
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

// ============================================
// Start Server
// ============================================

server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] WebSocket available at ws://localhost:${PORT}`);
  console.log(
    `[Server] Environment: ${isAzure ? "Azure App Service" : "Local"}`
  );
  console.log(`[Server] Data directory: ${DATA_DIR}`);
  console.log(`[Server] Uploads directory: ${UPLOADS_DIR}`);
});
