import 'dotenv/config';
import express from "express";
import { execFile } from "child_process";
import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import path from 'path';

const app = express();
// Increase limit for large files
app.use(express.json({ limit: "50mb" }));

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------

// Define the standard PMD Apex rulesets to use
// Using the "category/..." syntax required by PMD 6/7
const PMD_RULESETS = [
    "category/apex/design.xml",
    "category/apex/bestpractices.xml",
    "category/apex/errorprone.xml",
    "category/apex/performance.xml",
    "category/apex/security.xml",
    "category/apex/documentation.xml",
    "category/apex/codestyle.xml"
].join(",");

const PMD_BINARY = "/opt/pmd/bin/pmd";

// ------------------------------------------------------------------
// AI INITIALIZATION
// ------------------------------------------------------------------
let ai;
const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("🔑 Checking API Key...");
    
    if (apiKey) {
        try {
            ai = new GoogleGenAI({ apiKey });
            console.log("✅ Gemini AI initialized successfully");
        } catch (error) {
            console.error("❌ Failed to initialize Gemini:", error.message);
        }
    } else {
        console.log("⚠️  Gemini API key not found - AI suggestions will be disabled");
    }
};

initializeGemini();

// ------------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------------

// Health check endpoint
app.get("/health", async (req, res) => {
    let pmdStatus = 'unknown';
    try {
        // Check if native PMD is responding
        const version = await exec(PMD_BINARY, ["--version"]);
        pmdStatus = `available (${version.trim()})`;
    } catch (error) {
        pmdStatus = 'not available: ' + error.message;
    }

    res.json({ 
        status: "ok", 
        message: "PMD-Gemini Native Service is running",
        mode: "High Performance (Native PMD)",
        geminiAvailable: !!ai,
        pmdStatus: pmdStatus,
        timestamp: new Date().toISOString()
    });
});

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') res.sendStatus(200);
    else next();
});

// POST /run - Single file PMD scanning
app.post("/run", async (req, res) => {
    req.setTimeout(55000); 
    res.setTimeout(55000);
    
    try {
        console.log("🔍 Received single file PMD scan request (Native Mode)");
        const { filename, source } = req.body;
        
        if (!filename || !source) {
            return res.status(400).json({ error: "Both 'filename' and 'source' fields are required" });
        }

        const tmpDir = `/tmp/${uuid()}`;
        await fs.mkdir(tmpDir, { recursive: true });
        const filePath = path.join(tmpDir, filename);
        
        await fs.writeFile(filePath, source, "utf8");
        console.log(`🚀 Executing Native PMD on ${filePath}`);
        
        // Execute PMD
        // exit code 4 = violations found (normal), exit code 1 = error
        let pmdOutput = "";
        try {
            pmdOutput = await exec(PMD_BINARY, [
                "check",
                "--dir", filePath,
                "--format", "json",
                "--rulesets", PMD_RULESETS,
                "--no-cache"
            ]);
        } catch (err) {
            // Check for exit code 4 (Violations found), which is success for us
            if (err.code === 4 && err.stdout) {
                pmdOutput = err.stdout;
            } else {
                throw err; // Real error
            }
        }
        
        await fs.rm(tmpDir, { recursive: true, force: true });
        
        // Transform Native PMD JSON to match what your LWC expects (Array of files)
        let result = [];
        try {
            if (pmdOutput.trim()) {
                const rawJson = JSON.parse(pmdOutput);
                
                // Native PMD returns { "files": [...] }
                // We map this to maintain compatibility with your previous structure
                if (rawJson.files) {
                    result = rawJson.files.map(f => {
                        return {
                            fileName: f.filename,
                            violations: f.violations.map(v => ({
                                // Map native PMD fields to SF Scanner fields if needed, 
                                // or just pass them through. 
                                // Your LWC likely needs: line, rule, message/description
                                line: v.beginline,
                                endLine: v.endline,
                                ruleName: v.rule,       // Native uses 'rule', SF uses 'ruleName'
                                message: v.description, // Native uses 'description', SF uses 'message'
                                severity: v.priority,
                                category: v.ruleset
                            }))
                        };
                    });
                }
            }
        } catch (e) {
            console.error("Failed to parse PMD output", e);
            console.error("Raw Output:", pmdOutput);
        }
        
        res.json(result);
        
    } catch (error) {
        console.error("❌ Scan error:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /analyze - Batch PMD scanning
app.post("/analyze", async (req, res) => {
    req.setTimeout(120000);
    res.setTimeout(120000);
    
    try {
        console.log("🔍 Received batch PMD scan request (Native Mode)");
        const { classes } = req.body;
        
        if (!classes || !Array.isArray(classes)) {
            return res.status(400).json({ error: "Invalid payload: 'classes' array is required" });
        }

        const tmpDir = `/tmp/${uuid()}`;
        await fs.mkdir(tmpDir, { recursive: true });
        
        for (const cls of classes) {
            const fileName = cls.name.endsWith('.cls') ? cls.name : `${cls.name}.cls`;
            await fs.writeFile(path.join(tmpDir, fileName), cls.source, "utf8");
        }
        
        console.log(`🚀 Executing Native PMD on batch folder ${tmpDir} (${classes.length} files)`);
        
        let pmdOutput = "";
        try {
            pmdOutput = await exec(PMD_BINARY, [
                "check",
                "--dir", tmpDir,
                "--format", "json",
                "--rulesets", PMD_RULESETS,
                "--no-cache"
            ]);
        } catch (err) {
            if (err.code === 4 && err.stdout) {
                pmdOutput = err.stdout;
            } else {
                throw err;
            }
        }
        
        await fs.rm(tmpDir, { recursive: true, force: true });
        
        let violations = [];
        try {
            if (pmdOutput.trim()) {
                const parsed = JSON.parse(pmdOutput);
                
                // Flatten results for your "violations" response format
                if (parsed.files) {
                    parsed.files.forEach(file => {
                        const baseName = path.basename(file.filename).replace('.cls', '');
                        
                        file.violations.forEach(v => {
                            violations.push({
                                rule: v.rule,
                                description: v.description,
                                beginline: v.beginline,
                                priority: v.priority,
                                className: baseName
                            });
                        });
                    });
                }
            }
        } catch (e) {
            console.error("Failed to parse PMD output", e);
        }
        
        res.json({ violations: violations });
        
    } catch (error) {
        console.error("❌ Batch scan error:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /fix - AI Fix Suggestions
app.post("/fix", async (req, res) => {
    req.setTimeout(30000);
    
    try {
        console.log("🤖 Received AI fix suggestion request");
        const { prompt, code } = req.body;
        
        if (!prompt || !code) {
            return res.status(400).json({ error: "Both 'prompt' and 'code' fields are required" });
        }

        if (!ai) {
            return res.status(503).json({ error: "Gemini AI service not available" });
        }

        const fullPrompt = `Fix this Apex code PMD violation: "${prompt}"

CODE:
\`\`\`apex
${code}
\`\`\`

Provide:
1. Fixed code (concise)
2. Brief explanation (1-2 sentences)

Keep response under 200 words.`;

        const startTime = Date.now();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ Gemini response received in ${duration}ms`);
        
        res.json({ 
            patch: response.text,
            model: "gemini-2.5-flash",
            responseTime: `${duration}ms`
        });
        
    } catch (error) {
        console.error("❌ AI suggestion error:", error);
        if (error.message?.includes('quota')) {
            return res.status(429).json({ error: "API quota exceeded." });
        }
        res.status(500).json({ error: error.message || "AI service error" });
    }
});

// Utility: Execute shell commands with specialized error handling for PMD
function exec(bin, args) {
    return new Promise((resolve, reject) => {
        execFile(bin, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            // We pass the error object back to the caller to handle exit codes (like 4)
            if (error) {
                // Attach stdout to error object so caller can retrieve it
                error.stdout = stdout; 
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 PMD-Gemini Service running on port ${PORT}`);
    console.log(`⚡ Mode: Native PMD High Performance`);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));