import 'dotenv/config';
import express from "express";
import { execFile } from "child_process";
import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import path from 'path';

const app = express();
app.use(express.json({ limit: "50mb" }));

// Initialize Gemini AI with new SDK
let ai;
const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("🔑 Checking API Key...");
    console.log("API Key present:", !!apiKey);
    console.log("API Key length:", apiKey ? apiKey.length : 0);
    
    if (apiKey) {
        try {
            ai = new GoogleGenAI({ apiKey });
            console.log("✅ Gemini AI initialized successfully");
        } catch (error) {
            console.error("❌ Failed to initialize Gemini:", error.message);
        }
    } else {
        console.log("⚠️  Gemini API key not found - AI suggestions will be disabled");
        console.log("⚠️  Make sure GEMINI_API_KEY is set in your .env file");
    }
};

initializeGemini();

// Health check endpoint
app.get("/health", async (req, res) => {
    let pmdStatus = 'unknown';
    try {
        await exec("sf", ["scanner", "--help"]);
        pmdStatus = 'available';
    } catch (error) {
        pmdStatus = 'not available: ' + error.message;
    }

    res.json({ 
        status: "ok", 
        message: "PMD-Gemini Service is running",
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
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// POST /run - Single file PMD scanning
app.post("/run", async (req, res) => {
    req.setTimeout(55000); 
    res.setTimeout(55000);
    
    try {
        console.log("🔍 Received single file PMD scan request");
        const { filename, source } = req.body;
        
        if (!filename || !source) {
            return res.status(400).json({ 
                error: "Both 'filename' and 'source' fields are required" 
            });
        }

        const tmpDir = `/tmp/${uuid()}`;
        await fs.mkdir(tmpDir, { recursive: true });
        const filePath = path.join(tmpDir, filename);
        
        await fs.writeFile(filePath, source, "utf8");
        console.log(`🚀 Executing PMD on ${filePath}`);
        
        const pmdOutput = await exec("sf", [
            "scanner", "run", "--engine", "pmd", "--format", "json", "--target", filePath
        ]);
        
        await fs.rm(tmpDir, { recursive: true, force: true });
        
        let result = [];
        try {
            if (pmdOutput.trim()) {
                result = JSON.parse(pmdOutput);
            }
        } catch (e) {
            console.error("Failed to parse PMD output", e);
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
        console.log("🔍 Received batch PMD scan request");
        const { classes } = req.body;
        
        if (!classes || !Array.isArray(classes)) {
            return res.status(400).json({ 
                error: "Invalid payload: 'classes' array is required" 
            });
        }

        const tmpDir = `/tmp/${uuid()}`;
        await fs.mkdir(tmpDir, { recursive: true });
        
        for (const cls of classes) {
            const fileName = cls.name.endsWith('.cls') ? cls.name : `${cls.name}.cls`;
            await fs.writeFile(path.join(tmpDir, fileName), cls.source, "utf8");
        }
        
        console.log(`🚀 Executing PMD on batch folder ${tmpDir} (${classes.length} files)`);
        
        const pmdOutput = await exec("sf", [
            "scanner", "run", 
            "--engine", "pmd", 
            "--format", "json", 
            "--target", tmpDir
        ]);
        
        console.log("📝 Raw PMD Output:", pmdOutput);
        await fs.rm(tmpDir, { recursive: true, force: true });
        
        let rawResults = [];
        try {
            if (pmdOutput.trim()) {
                rawResults = JSON.parse(pmdOutput);
            }
        } catch (e) {
            console.error("Failed to parse PMD output", e);
        }
        
        const violations = [];
        for (const engineResult of rawResults) {
            const fullPath = engineResult.fileName;
            const baseName = path.basename(fullPath);
            const className = baseName.replace('.cls', '');
            
            for (const v of (engineResult.violations || [])) {
                violations.push({
                    rule: v.ruleName,
                    description: v.message,
                    beginline: v.line,
                    priority: v.severity,
                    className: className
                });
            }
        }
        
        res.json({ violations: violations });
        
    } catch (error) {
        console.error("❌ Batch scan error:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /fix - AI Fix Suggestions (NEW SDK)
app.post("/fix", async (req, res) => {
    req.setTimeout(30000);
    res.setTimeout(30000);
    
    try {
        console.log("🤖 Received AI fix suggestion request");
        const { prompt, code } = req.body;
        
        if (!prompt || !code) {
            return res.status(400).json({ 
                error: "Both 'prompt' and 'code' fields are required" 
            });
        }

        if (!ai) {
            return res.status(503).json({ 
                error: "Gemini AI service not available" 
            });
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

        console.log("⏱️  Sending request to Gemini...");
        const startTime = Date.now();
        
        // Using new SDK syntax with working model
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", // Using fastest stable model
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
            return res.status(429).json({ 
                error: "API quota exceeded. Please try again in a few moments.",
                details: "Rate limit reached"
            });
        }
        
        res.status(500).json({ 
            error: error.message || "AI service error"
        });
    }
});

// Test endpoint to check available models
app.get("/test-models", async (req, res) => {
    const modelsToTest = [
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ];

    const results = [];

    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: "Say hi"
            });
            
            results.push({
                model: modelName,
                status: '✅ WORKS',
                sample: response.text.substring(0, 30)
            });
            console.log(`✅ ${modelName} works!`);
        } catch (error) {
            results.push({
                model: modelName,
                status: '❌ FAILED',
                error: error.message.substring(0, 100)
            });
            console.log(`❌ ${modelName} failed: ${error.message}`);
        }
    }

    res.json({ 
        timestamp: new Date().toISOString(),
        results 
    });
});

// Utility function to execute shell commands
function exec(bin, args) {
    return new Promise((resolve, reject) => {
        execFile(bin, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                if (stdout) {
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || error.message));
                }
            } else {
                resolve(stdout);
            }
        });
    });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 PMD-Gemini Service running on port ${PORT}`);
    console.log(`ℹ️  Service Version: 2.0 (New Gemini SDK)`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 Test models: http://localhost:${PORT}/test-models`);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));