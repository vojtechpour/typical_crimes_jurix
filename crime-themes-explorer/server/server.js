const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");
const http = require("http");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Add timestamp to filename to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `uploaded_${timestamp}_${file.originalname}`;
    cb(null, name);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only accept JSON files
    if (
      file.mimetype === "application/json" ||
      file.originalname.endsWith(".json")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only JSON files are allowed"));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

app.use(cors());
app.use(express.json());

const SCRIPT_PATH = "/Users/vojtechpour/projects/typical-crimes/analysis_p2.py";
const DATA_DIR = "/Users/vojtechpour/projects/typical-crimes/data";
const UPLOADS_DIR = "/Users/vojtechpour/projects/typical-crimes/uploads";
const PYTHON_VENV =
  "/Users/vojtechpour/projects/typical-crimes/venv/bin/python3";

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log(`Created uploads directory: ${UPLOADS_DIR}`);
}

// Store active processes and their associated WebSocket connections
const activeProcesses = new Map();

// Global script management
let scriptProcess = null;
let p3ScriptProcess = null; // Add P3 script process tracking
let p4ScriptProcess = null; // Add P4 script process tracking

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("Client connected via WebSocket");

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// Broadcast message to all connected clients
function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// API Routes

// Get list of available data files
app.get("/api/data-files", (req, res) => {
  try {
    // Check if uploads directory exists and has files
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
      .sort((a, b) => b.modified - a.modified);

    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific data file content (with pagination for large files)
app.get("/api/data/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const { page = 1, limit = 50, search = "" } = req.query;

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Convert object to array if needed
    let items = Array.isArray(data)
      ? data
      : Object.entries(data).map(([id, item]) => ({
          id,
          ...item,
        }));

    // Apply search filter
    if (search) {
      items = items.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedItems = items.slice(startIndex, endIndex);

    res.json({
      items: paginatedItems,
      total: items.length,
      page: parseInt(page),
      totalPages: Math.ceil(items.length / limit),
      hasMore: endIndex < items.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get script status
app.get("/api/script/status", (req, res) => {
  const processId = "analysis_p2";
  const isRunning = activeProcesses.has(processId);

  res.json({
    running: isRunning,
    processId: isRunning ? processId : null,
  });
});

// Execute Python script
app.post("/api/script/execute", (req, res) => {
  const processId = "analysis_p2";
  const { dataFile, globalInstructions, model } = req.body; // Include model selection

  // Check if script is already running
  if (activeProcesses.has(processId)) {
    return res.status(409).json({
      error: "Script is already running",
      processId,
    });
  }

  try {
    // Change to the script directory
    const scriptDir = path.dirname(SCRIPT_PATH);

    // Use Python from the virtual environment
    const pythonExe =
      "/Users/vojtechpour/projects/typical-crimes/venv/bin/python3";

    // Prepare script arguments
    const scriptArgs = [SCRIPT_PATH];
    if (dataFile) {
      scriptArgs.push(dataFile);
      console.log(`Starting analysis with file: ${dataFile}`);
    } else {
      console.log("Starting analysis with default file");
    }

    // Add global instructions if provided
    if (globalInstructions && globalInstructions.trim()) {
      scriptArgs.push("--global-instructions", globalInstructions.trim());
      console.log(`Using global instructions: ${globalInstructions.trim()}`);
    } else {
      console.log("Using default best practices prompting");
    }

    // Determine provider from model selection
    // Default to Gemini if not specified or starts with "gemini"
    let provider = "gemini";
    let envVars = { ...process.env };
    if (model && typeof model === "string") {
      if (model.startsWith("gpt-")) {
        provider = "openai";
        envVars.OPENAI_MODEL = model; // analysis script can read this if using OpenAI
      } else {
        provider = "gemini";
        envVars.GEMINI_MODEL = model; // analysis script will read GEMINI_MODEL
      }
    }
    envVars.MODEL_PROVIDER = provider; // tell analysis script which provider to use

    // Spawn Python process using the virtual environment
    const pythonProcess = spawn(pythonExe, scriptArgs, {
      cwd: scriptDir,
      stdio: ["pipe", "pipe", "pipe"],
      env: envVars,
    });

    // Store process reference
    activeProcesses.set(processId, {
      process: pythonProcess,
      startTime: new Date(),
      output: [],
      errors: [],
      dataFile: dataFile || "default", // Store which file is being processed
    });

    // Send initial status
    broadcast({
      type: "script_started",
      processId,
      dataFile: dataFile || "default",
      timestamp: new Date().toISOString(),
    });

    // Handle stdout
    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      const timestamp = new Date().toLocaleTimeString();

      // Check for structured updates
      const lines = output.split("\n").filter((line) => line.trim());

      lines.forEach((line) => {
        if (line.startsWith("PROGRESS_UPDATE:")) {
          try {
            const progressData = JSON.parse(
              line.substring("PROGRESS_UPDATE:".length)
            );
            broadcast({
              type: "progressUpdate",
              data: progressData,
              timestamp,
            });
          } catch (e) {
            console.error("Error parsing progress update:", e);
          }
        } else if (line.startsWith("PHASE_UPDATE:")) {
          try {
            const phaseData = JSON.parse(
              line.substring("PHASE_UPDATE:".length)
            );
            broadcast({
              type: "phaseUpdate",
              data: phaseData,
              timestamp,
            });
          } catch (e) {
            console.error("Error parsing phase update:", e);
          }
        } else {
          // Regular log output
          broadcast({
            type: "output",
            text: line,
            timestamp,
            level: "info",
          });
        }
      });
    });

    // Handle stderr
    pythonProcess.stderr.on("data", (data) => {
      const error = data.toString();
      const processInfo = activeProcesses.get(processId);
      if (processInfo) {
        processInfo.errors.push(error);
      }

      broadcast({
        type: "script_error",
        processId,
        data: error,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle process completion
    pythonProcess.on("close", (code) => {
      const processInfo = activeProcesses.get(processId);
      const endTime = new Date();
      const duration = processInfo ? endTime - processInfo.startTime : 0;

      broadcast({
        type: "script_completed",
        processId,
        exitCode: code,
        duration,
        timestamp: endTime.toISOString(),
      });

      // Clean up process reference
      activeProcesses.delete(processId);
    });

    // Handle process error
    pythonProcess.on("error", (error) => {
      broadcast({
        type: "script_error",
        processId,
        data: `Process error: ${error.message}`,
        timestamp: new Date().toISOString(),
      });

      activeProcesses.delete(processId);
    });

    res.json({
      success: true,
      processId,
      message: "Script execution started",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop running script
app.post("/api/script/stop", (req, res) => {
  const processId = "analysis_p2";
  const processInfo = activeProcesses.get(processId);

  if (!processInfo) {
    return res.status(404).json({ error: "No running process found" });
  }

  try {
    processInfo.process.kill("SIGTERM");
    activeProcesses.delete(processId);

    broadcast({
      type: "script_stopped",
      processId,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: "Script stopped" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get script logs
app.get("/api/script/logs/:processId", (req, res) => {
  const { processId } = req.params;
  const processInfo = activeProcesses.get(processId);

  if (!processInfo) {
    return res.status(404).json({ error: "Process not found" });
  }

  res.json({
    output: processInfo.output,
    errors: processInfo.errors,
    startTime: processInfo.startTime,
    running: true,
  });
});

// Get analysis results
app.get("/api/results/latest", (req, res) => {
  try {
    // Check for the main data file that gets updated during analysis
    const dataFile = path.join(
      DATA_DIR,
      "kradeze_pripady_test_100_2_balanced_dedupl.json"
    );
    const logFile =
      "/Users/vojtechpour/projects/typical-crimes/analysis_p2.log";

    const results = {};

    // Get updated data if available
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      const total = Object.keys(data).length;
      const processed = Object.values(data).filter(
        (item) => item.initial_code_0
      ).length;

      results.progress = {
        total,
        processed,
        percentage: total > 0 ? ((processed / total) * 100).toFixed(1) : 0,
      };

      // Get sample of recent results
      const recentResults = Object.entries(data)
        .filter(([id, item]) => item.initial_code_0)
        .slice(-10)
        .map(([id, item]) => ({
          id,
          code: item.initial_code_0,
          text: item.plny_skutek_short?.substring(0, 100) + "...",
        }));

      results.recentResults = recentResults;
    }

    // Get log file info if available
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      results.logInfo = {
        size: stats.size,
        lastModified: stats.mtime,
      };
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload data file
app.post("/api/upload-data", upload.single("dataFile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate JSON structure
    const filePath = req.file.path;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Basic validation
    if (typeof data !== "object" || Array.isArray(data)) {
      // Delete the uploaded file if validation fails
      fs.unlinkSync(filePath);
      return res
        .status(400)
        .json({ error: "JSON must be an object, not an array" });
    }

    // Check for required fields in first few entries
    const entries = Object.entries(data).slice(0, 5);
    const requiredFields = ["plny_skutek_short"];

    for (const [id, item] of entries) {
      if (typeof item !== "object") {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "Each case must be an object" });
      }

      for (const field of requiredFields) {
        if (!(field in item)) {
          fs.unlinkSync(filePath);
          return res.status(400).json({
            error: `Missing required field: ${field}`,
          });
        }
      }
    }

    res.json({
      success: true,
      message: "File uploaded and validated successfully",
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      totalCases: Object.keys(data).length,
    });
  } catch (error) {
    // Delete the uploaded file if there's an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON format: " + error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete uploaded file
app.delete("/api/data/:filename", (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete the file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `File ${filename} deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update specific case codes in data file
app.put("/api/data/:filename/case/:caseId", (req, res) => {
  try {
    const { filename, caseId } = req.params;
    const { codes } = req.body;

    if (!codes || !Array.isArray(codes)) {
      return res
        .status(400)
        .json({ error: "Invalid codes format. Expected array." });
    }

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read current data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Check if case exists
    if (!(caseId in data)) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Update the case with new codes
    data[caseId].initial_code_0 = codes.length === 1 ? codes[0] : codes;

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

    // Log the update
    console.log(
      `Updated case ${caseId} in file ${filename} with codes:`,
      codes
    );

    res.json({
      success: true,
      message: `Case ${caseId} updated successfully`,
      caseId,
      codes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating case:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get existing initial codes from a data file
app.get("/api/data/:filename/codes", (req, res) => {
  try {
    const { filename } = req.params;
    const { limit = 50 } = req.query;

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Extract cases with existing initial codes
    const casesWithCodes = [];
    const allExistingCodes = []; // Collect all existing codes for consistency
    for (const [caseId, caseData] of Object.entries(data)) {
      if (caseData.initial_code_0) {
        casesWithCodes.push({
          caseId: caseId,
          codes: caseData.initial_code_0,
          caseText: caseData.plny_skutek_short || "",
          timestamp: new Date().toISOString(), // Use current time as we don't have original timestamp
        });
        // Also collect for consistency reference
        allExistingCodes.push(caseData.initial_code_0);
      }
    }

    // Sort by case ID and limit results
    casesWithCodes.sort((a, b) => a.caseId.localeCompare(b.caseId));
    const limitedCases = casesWithCodes.slice(0, parseInt(limit));

    // Calculate statistics
    const totalCases = Object.keys(data).length;
    const processedCases = casesWithCodes.length;

    // Get unique codes count
    const allCodes = [];
    casesWithCodes.forEach((case_) => {
      if (Array.isArray(case_.codes)) {
        allCodes.push(...case_.codes.map(String));
      } else {
        allCodes.push(String(case_.codes));
      }
    });
    const uniqueCodesCount = new Set(allCodes).size;

    res.json({
      cases: limitedCases,
      statistics: {
        totalCases,
        processedCases,
        uniqueCodesCount,
        remainingCases: totalCases - processedCases,
        percentage:
          totalCases > 0 ? ((processedCases / totalCases) * 100).toFixed(1) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching existing codes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete all initial codes in a data file
app.delete("/api/data/:filename/codes", (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const totalCases = Object.keys(data).length;
    let removedCount = 0;

    for (const [caseId, caseData] of Object.entries(data)) {
      if (
        caseData &&
        Object.prototype.hasOwnProperty.call(caseData, "initial_code_0")
      ) {
        delete caseData.initial_code_0;
        removedCount += 1;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

    console.log(
      `Deleted initial codes from ${removedCount}/${totalCases} cases in ${filename}`
    );

    res.json({
      success: true,
      message: `Deleted codes in ${removedCount} cases`,
      filename,
      totalCases,
      casesCleared: removedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting codes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate codes for a specific case using custom instructions
app.post("/api/data/:filename/case/:caseId/regenerate", (req, res) => {
  try {
    const { filename, caseId } = req.params;
    const { instructions, model } = req.body;

    // Instructions are optional - empty string will trigger universal prompt
    const userInstructions = instructions || "";

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read current data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Check if case exists
    if (!(caseId in data)) {
      return res.status(404).json({ error: "Case not found" });
    }

    const caseData = data[caseId];

    // Gather all existing codes for consistency (same approach as bulk regeneration)
    const allExistingCodes = [];
    for (const [id, case_data] of Object.entries(data)) {
      if (case_data.initial_code_0) {
        allExistingCodes.push(case_data.initial_code_0);
      }
    }

    // Create a Python script to call for regeneration
    const regenerationScript = path.join(
      __dirname,
      "..",
      "..",
      "regenerate_codes.py"
    );

    // Prepare the regeneration arguments
    const regenerationArgs = [
      regenerationScript,
      "--case-id",
      caseId,
      "--case-text",
      caseData.plny_skutek_short || "",
      "--instructions",
      userInstructions,
      "--existing-codes",
      JSON.stringify(caseData.initial_code_0 || []),
      "--all-existing-codes",
      JSON.stringify(allExistingCodes),
    ];

    // Use Python from the virtual environment
    const pythonExe =
      "/Users/vojtechpour/projects/typical-crimes/venv/bin/python3";

    // Determine provider and propagate selected model via env like Phase 2
    let provider = "gemini";
    const envVars = { ...process.env };
    if (model && typeof model === "string") {
      if (model.startsWith("gpt-")) {
        provider = "openai";
        envVars.OPENAI_MODEL = model;
      } else {
        provider = "gemini";
        envVars.GEMINI_MODEL = model;
      }
    }
    envVars.MODEL_PROVIDER = provider;

    // Spawn Python process for regeneration
    const pythonProcess = spawn(pythonExe, regenerationArgs, {
      cwd: path.dirname(regenerationScript),
      stdio: ["pipe", "pipe", "pipe"],
      env: envVars,
    });

    let outputData = "";
    let errorData = "";

    // Handle stdout
    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    // Handle stderr
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          // Parse the output as JSON
          const result = JSON.parse(outputData.trim());

          if (result.success && result.codes) {
            // Update the case with new codes
            data[caseId].initial_code_0 = result.codes;

            // Write back to file
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

            // Log the regeneration
            console.log(
              `Regenerated codes for case ${caseId} in file ${filename}:`,
              result.codes
            );

            res.json({
              success: true,
              message: `Codes regenerated successfully for case ${caseId}`,
              caseId,
              codes: result.codes,
              instructions: userInstructions,
              timestamp: new Date().toISOString(),
            });
          } else {
            throw new Error(result.error || "Regeneration failed");
          }
        } catch (parseError) {
          console.error("Error parsing regeneration output:", parseError);
          console.error("Raw output:", outputData);
          console.error("Error output:", errorData);
          res.status(500).json({
            error: "Failed to parse regeneration results",
            details: parseError.message,
          });
        }
      } else {
        console.error("Regeneration process failed with code:", code);
        console.error("Error output:", errorData);
        res.status(500).json({
          error: "Regeneration process failed",
          details: errorData,
        });
      }
    });

    // Handle process error
    pythonProcess.on("error", (error) => {
      console.error("Error spawning regeneration process:", error);
      res.status(500).json({
        error: "Failed to start regeneration process",
        details: error.message,
      });
    });
  } catch (error) {
    console.error("Error in regeneration endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk regenerate all existing codes in a data file
app.post("/api/data/:filename/bulk-regenerate", (req, res) => {
  try {
    const { filename } = req.params;
    const { instructions } = req.body;

    if (
      !instructions ||
      typeof instructions !== "string" ||
      instructions.trim().length === 0
    ) {
      return res
        .status(400)
        .json({ error: "Instructions are required for bulk regeneration" });
    }

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read current data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Find all cases with existing initial codes
    const casesWithCodes = [];
    const allExistingCodes = []; // Collect all existing codes for consistency
    for (const [caseId, caseData] of Object.entries(data)) {
      if (caseData.initial_code_0) {
        casesWithCodes.push({
          caseId,
          caseText: caseData.plny_skutek_short || "",
          existingCodes: caseData.initial_code_0,
        });
        // Also collect for consistency reference
        allExistingCodes.push(caseData.initial_code_0);
      }
    }

    if (casesWithCodes.length === 0) {
      return res.json({
        success: true,
        message: "No existing codes found to regenerate",
        updated_cases: 0,
      });
    }

    console.log(
      `Starting bulk regeneration for ${casesWithCodes.length} cases in ${filename}`
    );

    // Create a Python script to call for bulk regeneration
    const bulkRegenerationScript = path.join(
      __dirname,
      "..",
      "..",
      "bulk_regenerate_codes.py"
    );

    // Prepare the regeneration arguments
    const regenerationArgs = [
      bulkRegenerationScript,
      "--filename",
      filename,
      "--instructions",
      instructions.trim(),
      "--cases-data",
      JSON.stringify(casesWithCodes),
      "--all-existing-codes",
      JSON.stringify(allExistingCodes),
    ];

    // Use Python from the virtual environment
    const pythonExe =
      "/Users/vojtechpour/projects/typical-crimes/venv/bin/python3";

    // Spawn Python process for bulk regeneration
    const pythonProcess = spawn(pythonExe, regenerationArgs, {
      cwd: path.dirname(bulkRegenerationScript),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let outputData = "";
    let errorData = "";

    // Handle stdout
    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();

      // Check for progress updates in the output
      const output = data.toString();
      const lines = output.split("\n").filter((line) => line.trim());

      lines.forEach((line) => {
        if (line.startsWith("BULK_PROGRESS_UPDATE:")) {
          try {
            const progressData = JSON.parse(
              line.substring("BULK_PROGRESS_UPDATE:".length)
            );
            // Broadcast progress update to all connected clients
            broadcast({
              type: "bulkProgressUpdate",
              data: progressData,
              filename: filename,
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            console.error("Error parsing bulk progress update:", e);
          }
        }
      });
    });

    // Handle stderr
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          // The output contains both progress updates and the final JSON result
          // We need to extract only the final JSON result
          const lines = outputData.trim().split("\n");
          let finalJsonLine = "";

          // Find the last line that looks like JSON (starts with { and ends with })
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (
              line.startsWith("{") &&
              line.endsWith("}") &&
              !line.startsWith("BULK_PROGRESS_UPDATE:")
            ) {
              finalJsonLine = line;
              break;
            }
          }

          if (!finalJsonLine) {
            throw new Error("No valid JSON result found in output");
          }

          // Parse the final JSON result
          const result = JSON.parse(finalJsonLine);

          if (result.success) {
            // Update the file with all regenerated codes
            for (const [caseId, newCodes] of Object.entries(
              result.updated_codes
            )) {
              if (data[caseId]) {
                data[caseId].initial_code_0 = newCodes;
              }
            }

            // Write back to file
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

            console.log(
              `Bulk regeneration completed: ${result.updated_cases} cases updated in ${filename}`
            );

            res.json({
              success: true,
              message: `Successfully regenerated codes for ${result.updated_cases} cases`,
              updated_cases: result.updated_cases,
              total_cases: casesWithCodes.length,
              timestamp: new Date().toISOString(),
            });
          } else {
            throw new Error(result.error || "Bulk regeneration failed");
          }
        } catch (parseError) {
          console.error("Error parsing bulk regeneration output:", parseError);
          console.error("Raw output:", outputData);
          console.error("Error output:", errorData);
          res.status(500).json({
            error: "Failed to parse bulk regeneration results",
            details: parseError.message,
          });
        }
      } else {
        console.error("Bulk regeneration process failed with code:", code);
        console.error("Error output:", errorData);
        res.status(500).json({
          error: "Bulk regeneration process failed",
          details: errorData,
        });
      }
    });

    // Handle process error
    pythonProcess.on("error", (error) => {
      console.error("Error spawning bulk regeneration process:", error);
      res.status(500).json({
        error: "Failed to start bulk regeneration process",
        details: error.message,
      });
    });
  } catch (error) {
    console.error("Error in bulk regeneration endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

// P3 Analysis Routes
// Start P3 analysis script
app.post("/api/p3/execute", (req, res) => {
  if (p3ScriptProcess) {
    return res.status(400).json({ error: "P3 script is already running" });
  }

  try {
    const { dataFile, model } = req.body;

    if (!dataFile) {
      return res.status(400).json({ error: "Data file is required" });
    }

    console.log(
      `Starting P3 analysis with data file: ${dataFile} (model: ${
        model || process.env.GEMINI_MODEL || "default"
      })`
    );

    // Broadcast start message
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "p3_script_started",
            timestamp: new Date().toISOString(),
          })
        );
      }
    });

    // Construct the Python command
    const pythonArgs = ["analysis_p3.py", "--data-file", dataFile];

    console.log(`Executing: python3 ${pythonArgs.join(" ")}`);

    // Determine provider and set env similarly to Phase 2 route
    let provider = "gemini";
    const envVars = { ...process.env };
    if (model && typeof model === "string") {
      if (model.startsWith("gpt-")) {
        provider = "openai";
        envVars.OPENAI_MODEL = model;
      } else {
        provider = "gemini";
        envVars.GEMINI_MODEL = model;
      }
    }
    envVars.MODEL_PROVIDER = provider;

    p3ScriptProcess = spawn(PYTHON_VENV, pythonArgs, {
      cwd: __dirname + "/../..",
      env: envVars,
    });

    let outputData = "";
    let p3Completed = false;

    p3ScriptProcess.stdout.on("data", (data) => {
      const output = data.toString();
      outputData += output;

      // Handle P3 progress updates
      const lines = output.split("\n");
      lines.forEach((line) => {
        if (line.startsWith("P3_PROGRESS_UPDATE:")) {
          try {
            const jsonData = line.substring("P3_PROGRESS_UPDATE:".length);
            const progressData = JSON.parse(jsonData);

            // Broadcast progress update
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "p3ProgressUpdate",
                    data: progressData,
                    timestamp: new Date().toISOString(),
                  })
                );
              }
            });
          } catch (error) {
            console.error("Error parsing P3 progress update:", error);
          }
        } else if (line.startsWith("P3_PHASE_UPDATE:")) {
          try {
            const jsonData = line.substring("P3_PHASE_UPDATE:".length);
            const phaseData = JSON.parse(jsonData);

            // Broadcast phase update
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "p3PhaseUpdate",
                    data: phaseData,
                    timestamp: new Date().toISOString(),
                  })
                );
              }
            });
          } catch (error) {
            console.error("Error parsing P3 phase update:", error);
          }
        } else if (line.trim()) {
          // Regular output line
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "output",
                  text: line,
                  timestamp: new Date().toLocaleTimeString(),
                  level: "info",
                })
              );
            }
          });
        }
      });
    });

    p3ScriptProcess.stderr.on("data", (data) => {
      const errorOutput = data.toString();
      console.error("P3 script stderr:", errorOutput);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "p3_script_error",
              data: errorOutput,
              timestamp: new Date().toISOString(),
            })
          );
        }
      });
    });

    p3ScriptProcess.on("close", (code) => {
      console.log(`P3 script exited with code ${code}`);
      p3Completed = code === 0;

      if (p3Completed) {
        // P3 completed successfully, now start P3b automatically
        console.log("P3 completed successfully, starting P3b analysis...");

        // Broadcast P3 completion and P3b start
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "p3_completed_starting_p3b",
                timestamp: new Date().toISOString(),
              })
            );
          }
        });

        // Start P3b analysis
        startP3bAnalysis(dataFile, model);
      } else {
        // P3 failed or was stopped
        const messageType = "p3_script_stopped";
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: messageType,
                code: code,
                timestamp: new Date().toISOString(),
              })
            );
          }
        });
      }

      p3ScriptProcess = null;
    });

    res.json({
      success: true,
      message: "P3 analysis started successfully",
      dataFile: dataFile,
    });
  } catch (error) {
    console.error("Error starting P3 script:", error);
    res.status(500).json({ error: "Failed to start P3 script" });
  }
});

// P3b analysis function
let p3bScriptProcess = null;

function startP3bAnalysis(dataFile, model) {
  try {
    console.log(`Starting P3b analysis for data file: ${dataFile}`);

    // Broadcast P3b start message
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "p3b_script_started",
            dataFile: dataFile,
            timestamp: new Date().toISOString(),
          })
        );
      }
    });

    // Construct the Python command for P3b
    const pythonArgs = ["analysis_p3b.py"];

    console.log(`Executing P3b: python3 ${pythonArgs.join(" ")}`);

    // Carry model/provider from P3 into P3b
    let provider = "gemini";
    const envVars = { ...process.env };
    if (model && typeof model === "string") {
      if (model.startsWith("gpt-")) {
        provider = "openai";
        envVars.OPENAI_MODEL = model;
      } else {
        provider = "gemini";
        envVars.GEMINI_MODEL = model;
      }
    }
    envVars.MODEL_PROVIDER = provider;

    p3bScriptProcess = spawn(PYTHON_VENV, pythonArgs, {
      cwd: __dirname + "/../..",
      env: envVars,
    });

    let p3bOutputData = "";

    p3bScriptProcess.stdout.on("data", (data) => {
      const output = data.toString();
      p3bOutputData += output;

      // Broadcast P3b output
      const lines = output.split("\n");
      lines.forEach((line) => {
        if (line.trim()) {
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "p3b_output",
                  text: line,
                  timestamp: new Date().toLocaleTimeString(),
                  level: "info",
                })
              );
            }
          });
        }
      });
    });

    p3bScriptProcess.stderr.on("data", (data) => {
      const errorOutput = data.toString();
      console.error("P3b script stderr:", errorOutput);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "p3b_script_error",
              data: errorOutput,
              timestamp: new Date().toISOString(),
            })
          );
        }
      });
    });

    p3bScriptProcess.on("close", (code) => {
      console.log(`P3b script exited with code ${code}`);

      const messageType =
        code === 0 ? "p3b_script_finished" : "p3b_script_failed";

      // Broadcast P3b completion
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: messageType,
              code: code,
              output: p3bOutputData,
              timestamp: new Date().toISOString(),
            })
          );
        }
      });

      p3bScriptProcess = null;
    });
  } catch (error) {
    console.error("Error starting P3b script:", error);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "p3b_script_error",
            data: `Failed to start P3b: ${error.message}`,
            timestamp: new Date().toISOString(),
          })
        );
      }
    });
  }
}

// Get P3 script status
app.get("/api/p3/status", (req, res) => {
  res.json({
    running: p3ScriptProcess !== null,
    pid: p3ScriptProcess?.pid,
    p3bRunning: p3bScriptProcess !== null,
    p3bPid: p3bScriptProcess?.pid,
  });
});

// Phase 4: Assign finalized themes to dataset
app.post("/api/p4/execute", (req, res) => {
  if (p4ScriptProcess) {
    return res.status(400).json({ error: "P4 script is already running" });
  }

  try {
    // analysis_p4.py reads its own inputs; no params required
    const pythonArgs = ["analysis_p4.py"]; // runs from repo root

    // Inform clients
    broadcast({
      type: "p4_script_started",
      timestamp: new Date().toISOString(),
    });

    p4ScriptProcess = spawn("python3", pythonArgs, {
      cwd: __dirname + "/../..",
    });

    p4ScriptProcess.stdout.on("data", (data) => {
      const text = data.toString();
      const lines = text.split("\n").filter((l) => l.trim());
      lines.forEach((line) => {
        broadcast({
          type: "p4_output",
          text: line,
          timestamp: new Date().toLocaleTimeString(),
        });
      });
    });

    p4ScriptProcess.stderr.on("data", (data) => {
      broadcast({
        type: "p4_script_error",
        data: data.toString(),
        timestamp: new Date().toISOString(),
      });
    });

    p4ScriptProcess.on("close", (code) => {
      broadcast({
        type: code === 0 ? "p4_script_finished" : "p4_script_failed",
        code,
        timestamp: new Date().toISOString(),
      });
      p4ScriptProcess = null;
    });

    res.json({ success: true, message: "P4 started" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start P4 script" });
  }
});

app.get("/api/p4/status", (req, res) => {
  res.json({ running: p4ScriptProcess !== null, pid: p4ScriptProcess?.pid });
});

app.post("/api/p4/stop", (req, res) => {
  if (!p4ScriptProcess) {
    return res.status(400).json({ error: "No P4 script is running" });
  }
  try {
    p4ScriptProcess.kill("SIGTERM");
    p4ScriptProcess = null;
    broadcast({
      type: "p4_script_stopped",
      timestamp: new Date().toISOString(),
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to stop P4" });
  }
});

// Stop P3 script
app.post("/api/p3/stop", (req, res) => {
  let stoppedProcesses = [];

  if (p3ScriptProcess) {
    try {
      p3ScriptProcess.kill("SIGTERM");
      stoppedProcesses.push("P3");
    } catch (error) {
      console.error("Error stopping P3 script:", error);
    }
  }

  if (p3bScriptProcess) {
    try {
      p3bScriptProcess.kill("SIGTERM");
      stoppedProcesses.push("P3b");
    } catch (error) {
      console.error("Error stopping P3b script:", error);
    }
  }

  if (stoppedProcesses.length === 0) {
    return res.status(400).json({ error: "No P3 or P3b script is running" });
  }

  // Broadcast stop message
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "p3_scripts_stopped",
          stoppedProcesses: stoppedProcesses,
          timestamp: new Date().toISOString(),
        })
      );
    }
  });

  res.json({
    success: true,
    message: `${stoppedProcesses.join(" and ")} script stop signal sent`,
    stoppedProcesses: stoppedProcesses,
  });
});

// Get P3 results
app.get("/api/p3/results/latest", (req, res) => {
  try {
    // This could be expanded to read actual P3 results
    res.json({
      message: "P3 results endpoint - to be implemented based on output format",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching P3 results:", error);
    res.status(500).json({ error: "Failed to fetch P3 results" });
  }
});

// P3 Theme Management Routes

// Get existing candidate themes from a data file
app.get("/api/data/:filename/themes", (req, res) => {
  try {
    const { filename } = req.params;
    const { limit = 50 } = req.query;

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Extract cases with existing candidate themes
    const casesWithThemes = [];
    const allExistingThemes = []; // Collect all existing themes for consistency
    for (const [caseId, caseData] of Object.entries(data)) {
      if (caseData.candidate_theme || caseData.theme) {
        casesWithThemes.push({
          caseId: caseId,
          candidate_theme: caseData.candidate_theme, // P3 candidate theme
          theme: caseData.theme, // P3b finalized theme
          initialCodes: caseData.initial_code_0 || [],
          caseText: caseData.plny_skutek_short || "",
          timestamp: new Date().toISOString(), // Use current time as we don't have original timestamp
        });
        // Also collect for consistency reference (prioritize candidate_theme for existing themes list)
        if (caseData.candidate_theme) {
          allExistingThemes.push(caseData.candidate_theme);
        }
      }
    }

    // Sort by case ID and limit results
    casesWithThemes.sort((a, b) => a.caseId.localeCompare(b.caseId));
    const limitedCases = casesWithThemes.slice(0, parseInt(limit));

    // Calculate statistics
    const totalCases = Object.keys(data).length;
    const processedCases = casesWithThemes.length;

    // Get unique themes count
    const uniqueThemesCount = new Set(allExistingThemes.map(String)).size;

    res.json({
      cases: limitedCases,
      statistics: {
        totalCases,
        processedCases,
        uniqueThemesCount,
        remainingCases: totalCases - processedCases,
        percentage:
          totalCases > 0 ? ((processedCases / totalCases) * 100).toFixed(1) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching existing themes:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update specific case theme (both candidate_theme and theme) in data file
app.put("/api/data/:filename/case/:caseId/update-theme", (req, res) => {
  try {
    const { filename, caseId } = req.params;
    const { themeType, theme } = req.body;

    if (!themeType || !["candidate_theme", "theme"].includes(themeType)) {
      return res.status(400).json({
        error: "Invalid themeType. Must be 'candidate_theme' or 'theme'.",
      });
    }

    if (
      theme !== null &&
      (typeof theme !== "string" || theme.trim().length === 0)
    ) {
      return res.status(400).json({
        error: "Invalid theme format. Expected non-empty string or null.",
      });
    }

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read current data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Check if case exists
    if (!(caseId in data)) {
      return res.status(404).json({ error: "Case not found" });
    }

    // Update the case with new theme
    if (theme === null) {
      // Delete the theme field
      delete data[caseId][themeType];
    } else {
      data[caseId][themeType] = theme.trim();
    }

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

    // Log the update
    console.log(
      `Updated ${themeType} for case ${caseId} in file ${filename}: ${theme}`
    );

    res.json({
      success: true,
      message: `Case ${caseId} ${themeType} updated successfully`,
      caseId,
      themeType,
      theme,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating case theme:", error);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate theme for a specific case using custom instructions
app.post("/api/data/:filename/case/:caseId/regenerate-theme", (req, res) => {
  try {
    const { filename, caseId } = req.params;
    const { instructions } = req.body;

    // Instructions are optional - empty string will trigger universal prompt
    const userInstructions = instructions || "";

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read current data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Check if case exists
    if (!(caseId in data)) {
      return res.status(404).json({ error: "Case not found" });
    }

    const caseData = data[caseId];

    // Gather all existing themes for consistency
    const allExistingThemes = [];
    for (const [id, case_data] of Object.entries(data)) {
      if (case_data.candidate_theme) {
        allExistingThemes.push(case_data.candidate_theme);
      }
    }

    // Create a Python script to call for P3 theme regeneration
    const regenerationScript = path.join(
      __dirname,
      "..",
      "..",
      "regenerate_themes_p3.py"
    );

    // Prepare the regeneration arguments
    const regenerationArgs = [
      regenerationScript,
      "--case-id",
      caseId,
      "--initial-codes",
      JSON.stringify(caseData.initial_code_0 || []),
      "--instructions",
      userInstructions,
      "--existing-theme",
      caseData.candidate_theme || "",
      "--all-existing-themes",
      JSON.stringify(allExistingThemes),
    ];

    // Use Python from the virtual environment
    const pythonExe =
      "/Users/vojtechpour/projects/typical-crimes/venv/bin/python3";

    // Spawn Python process for regeneration
    const pythonProcess = spawn(pythonExe, regenerationArgs, {
      cwd: path.dirname(regenerationScript),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let outputData = "";
    let errorData = "";

    // Handle stdout
    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    // Handle stderr
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          // Parse the output as JSON
          const result = JSON.parse(outputData.trim());

          if (result.success && result.theme) {
            // Update the case with new theme
            data[caseId].candidate_theme = result.theme;

            // Write back to file
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

            // Log the regeneration
            console.log(
              `Regenerated theme for case ${caseId} in file ${filename}: ${result.theme}`
            );

            res.json({
              success: true,
              message: `Theme regenerated successfully for case ${caseId}`,
              caseId,
              theme: result.theme,
              instructions: userInstructions,
              timestamp: new Date().toISOString(),
            });
          } else {
            throw new Error(result.error || "Theme regeneration failed");
          }
        } catch (parseError) {
          console.error("Error parsing theme regeneration output:", parseError);
          console.error("Raw output:", outputData);
          console.error("Error output:", errorData);
          res.status(500).json({
            error: "Failed to parse theme regeneration results",
            details: parseError.message,
          });
        }
      } else {
        console.error("Theme regeneration process failed with code:", code);
        console.error("Error output:", errorData);
        res.status(500).json({
          error: "Theme regeneration process failed",
          details: errorData,
        });
      }
    });

    // Handle process error
    pythonProcess.on("error", (error) => {
      console.error("Error spawning theme regeneration process:", error);
      res.status(500).json({
        error: "Failed to start theme regeneration process",
        details: error.message,
      });
    });
  } catch (error) {
    console.error("Error in theme regeneration endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk regenerate all existing themes in a data file
app.post("/api/data/:filename/bulk-regenerate-themes", (req, res) => {
  try {
    const { filename } = req.params;
    const { instructions } = req.body;

    if (
      !instructions ||
      typeof instructions !== "string" ||
      instructions.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Instructions are required for bulk theme regeneration",
      });
    }

    const filePath = path.join(UPLOADS_DIR, filename);

    // Security check: ensure the file is in the uploads directory
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // Read current data
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Find all cases with existing candidate themes
    const casesWithThemes = [];
    const allExistingThemes = []; // Collect all existing themes for consistency
    for (const [caseId, caseData] of Object.entries(data)) {
      if (caseData.candidate_theme || caseData.theme) {
        casesWithThemes.push({
          caseId,
          existingCodes: caseData.initial_code_0 || [],
          existingTheme: caseData.candidate_theme || caseData.theme,
        });
        // Also collect for consistency reference
        if (caseData.candidate_theme) {
          allExistingThemes.push(caseData.candidate_theme);
        }
      }
    }

    if (casesWithThemes.length === 0) {
      return res.json({
        success: true,
        message: "No existing themes found to regenerate",
        updated_cases: 0,
      });
    }

    console.log(
      `Starting bulk theme regeneration for ${casesWithThemes.length} cases in ${filename}`
    );

    // Create a Python script to call for bulk theme regeneration
    const bulkRegenerationScript = path.join(
      __dirname,
      "..",
      "..",
      "bulk_regenerate_themes_p3.py"
    );

    // Prepare the regeneration arguments
    const regenerationArgs = [
      bulkRegenerationScript,
      "--filename",
      filename,
      "--instructions",
      instructions.trim(),
      "--cases-data",
      JSON.stringify(casesWithThemes),
      "--all-existing-themes",
      JSON.stringify(allExistingThemes),
    ];

    // Use Python from the virtual environment
    const pythonExe =
      "/Users/vojtechpour/projects/typical-crimes/venv/bin/python3";

    // Spawn Python process for bulk theme regeneration
    const pythonProcess = spawn(pythonExe, regenerationArgs, {
      cwd: path.dirname(bulkRegenerationScript),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let outputData = "";
    let errorData = "";

    // Handle stdout
    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();

      // Check for progress updates in the output
      const output = data.toString();
      const lines = output.split("\n").filter((line) => line.trim());

      lines.forEach((line) => {
        if (line.startsWith("P3_BULK_PROGRESS_UPDATE:")) {
          try {
            const progressData = JSON.parse(
              line.substring("P3_BULK_PROGRESS_UPDATE:".length)
            );
            // Broadcast progress update to all connected clients
            broadcast({
              type: "p3BulkProgressUpdate",
              data: progressData,
              filename: filename,
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            console.error("Error parsing P3 bulk progress update:", e);
          }
        }
      });
    });

    // Handle stderr
    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          // The output contains both progress updates and the final JSON result
          // We need to extract only the final JSON result
          const lines = outputData.trim().split("\n");
          let finalJsonLine = "";

          // Find the last line that looks like JSON (starts with { and ends with })
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (
              line.startsWith("{") &&
              line.endsWith("}") &&
              !line.startsWith("P3_BULK_PROGRESS_UPDATE:")
            ) {
              finalJsonLine = line;
              break;
            }
          }

          if (!finalJsonLine) {
            throw new Error("No valid JSON result found in output");
          }

          // Parse the final JSON result
          const result = JSON.parse(finalJsonLine);

          if (result.success) {
            // Update the file with all regenerated themes
            for (const [caseId, newTheme] of Object.entries(
              result.updated_themes
            )) {
              if (data[caseId]) {
                data[caseId].candidate_theme = newTheme;
              }
            }

            // Write back to file
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

            console.log(
              `Bulk theme regeneration completed: ${result.updated_cases} cases updated in ${filename}`
            );

            res.json({
              success: true,
              message: `Successfully regenerated themes for ${result.updated_cases} cases`,
              updated_cases: result.updated_cases,
              total_cases: casesWithThemes.length,
              timestamp: new Date().toISOString(),
            });
          } else {
            throw new Error(result.error || "Bulk theme regeneration failed");
          }
        } catch (parseError) {
          console.error(
            "Error parsing bulk theme regeneration output:",
            parseError
          );
          console.error("Raw output:", outputData);
          console.error("Error output:", errorData);
          res.status(500).json({
            error: "Failed to parse bulk theme regeneration results",
            details: parseError.message,
          });
        }
      } else {
        console.error(
          "Bulk theme regeneration process failed with code:",
          code
        );
        console.error("Error output:", errorData);
        res.status(500).json({
          error: "Bulk theme regeneration process failed",
          details: errorData,
        });
      }
    });

    // Handle process error
    pythonProcess.on("error", (error) => {
      console.error("Error spawning bulk theme regeneration process:", error);
      res.status(500).json({
        error: "Failed to start bulk theme regeneration process",
        details: error.message,
      });
    });
  } catch (error) {
    console.error("Error in bulk theme regeneration endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

// AI Suggestions endpoint
app.post("/api/ai-suggestions", async (req, res) => {
  try {
    const { prompt, themeData, aiSettings } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const pythonExe =
      "/Users/vojtechpour/projects/typical-crimes/venv/bin/python3";
    const aiScriptPath = path.join(__dirname, "ai_suggestions.py");

    // Execute the Python script
    const pythonArgs = [aiScriptPath, prompt, JSON.stringify(themeData)];
    if (aiSettings) {
      pythonArgs.push(JSON.stringify(aiSettings));
    }

    const pythonProcess = spawn(pythonExe, pythonArgs, {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let outputData = "";
    let errorData = "";

    pythonProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(outputData.trim());
          if (result.success) {
            res.json({ content: result.content });
          } else {
            console.error("AI script error:", result.error);
            res.status(500).json({ error: result.error });
          }
        } catch (parseError) {
          console.error("Error parsing AI response:", parseError);
          console.error("Raw output:", outputData);
          res.status(500).json({
            error: "Failed to parse AI response",
            details: parseError.message,
          });
        }
      } else {
        console.error("AI script failed with code:", code);
        console.error("Error output:", errorData);
        res.status(500).json({
          error: "AI script execution failed",
          details: errorData,
        });
      }
    });

    pythonProcess.on("error", (error) => {
      console.error("Error spawning AI process:", error);
      res.status(500).json({
        error: "Failed to start AI process",
        details: error.message,
      });
    });
  } catch (error) {
    console.error("Error in AI suggestions endpoint:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 9000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
