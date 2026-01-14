import 'dotenv/config';
import express from "express";
import { execFile } from "child_process";
import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';

const app = express();
app.use(express.json({ limit: "50mb" })); // Increased limit for batch analysis

// Initialize Gemini AI
let genAI;
const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        genAI = new GoogleGenerativeAI(apiKey);
        console.log("✅ Gemini AI initialized successfully");
    } else {
        console.log("⚠️  Gemini API key not found - AI suggestions will be disabled");
    }
};

// Initialize Gemini on startup
initializeGemini();

// Health check endpoint with PMD test
app.get("/health", async (req, res) => {
    let pmdStatus = 'unknown';
    try {
        // Test if PMD scanner is available
        await exec("sf", ["scanner", "--help"]);
        pmdStatus = 'available';
    } catch (error) {
        pmdStatus = 'not available: ' + error.message;
    }

    res.json({ 
        status: "ok", 
        message: "PMD-Gemini Service is running",
        geminiAvailable: !!genAI,
        pmdStatus: pmdStatus,
        timestamp: new Date().toISOString()
    });
});

// CORS headers for Salesforce
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

// POST /run - Single file PMD Scanning endpoint (Used by DashboardController)
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

// POST /analyze - Batch PMD Scanning endpoint (Used by AFD_PMDAnalysis)
app.post("/analyze", async (req, res) => {
    req.setTimeout(120000); // 2 minutes timeout for batch
    res.setTimeout(120000);
    
    try {
        console.log("🔍 Received batch PMD scan request");
        const { classes } = req.body; // Expects { classes: [{ name, source }] }
        
        if (!classes || !Array.isArray(classes)) {
            return res.status(400).json({ 
                error: "Invalid payload: 'classes' array is required" 
            });
        }

        const tmpDir = `/tmp/${uuid()}`;
        await fs.mkdir(tmpDir, { recursive: true });
        
        // Write all files
        for (const cls of classes) {
            const fileName = cls.name.endsWith('.cls') ? cls.name : `${cls.name}.cls`;
            await fs.writeFile(path.join(tmpDir, fileName), cls.source, "utf8");
        }
        
        console.log(`🚀 Executing PMD on batch folder ${tmpDir} (${classes.length} files)`);
        
        // Add categories to ensure rules are actually run
        const pmdOutput = await exec("sf", [
            "scanner", "run", 
            "--engine", "pmd", 
            "--format", "json", 
            "--target", tmpDir,
            "--category", "Design,Best Practices,Performance,Security,Error Prone"
        ]);
        
        console.log("📝 Raw PMD Output:", pmdOutput); // Debug log
        
        await fs.rm(tmpDir, { recursive: true, force: true });
        
        // Parse and transform results to match AFD_PMDAnalysis expectation
        let rawResults = [];
        try {
            if (pmdOutput.trim()) {
                rawResults = JSON.parse(pmdOutput);
            }
        } catch (e) {
            console.error("Failed to parse PMD output", e);
        }
        
        // Transform: Flat list of violations with 'className' property
        const violations = [];
        for (const engineResult of rawResults) {
            // Extract class name from file path
            // engineResult.fileName is like /tmp/uuid/MyClass.cls
            const fullPath = engineResult.fileName;
            const baseName = path.basename(fullPath); // MyClass.cls
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

// POST /fix - AI Fix Suggestions endpoint
app.post("/fix", async (req, res) => {
    try {
        console.log("🤖 Received AI fix suggestion request");
        const { prompt, code } = req.body;
        
        if (!prompt || !code) {
            return res.status(400).json({ 
                error: "Both 'prompt' and 'code' fields are required" 
            });
        }

        if (!genAI) {
            return res.status(503).json({ 
                error: "Gemini AI service not available" 
            });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const fullPrompt = `You are an expert Salesforce Apex developer. 

TASK: Fix the following Apex code to resolve this PMD violation: "${prompt}"

CODE TO FIX:
\`\`\`apex
${code}
\`\`\`

REQUIREMENTS:
1. Provide the corrected code snippet
2. Explain what was wrong and why the fix works
3. Keep the solution concise
4. Maintain the original functionality

FORMAT YOUR RESPONSE AS:
**Fixed Code:**
\`\`\`apex
[corrected code here]
\`\`\`

**Explanation:**
[Brief explanation]`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const suggestion = response.text();
        
        res.json({ 
            patch: suggestion,
            model: "gemini-1.5-flash"
        });
        
    } catch (error) {
        console.error("❌ AI suggestion error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Utility function to execute shell commands
function exec(bin, args) {
    return new Promise((resolve, reject) => {
        execFile(bin, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                // Warning: sf scanner writes some warnings to stderr, which might trigger this
                // But typically fatal errors are here. 
                // However, successfully finding violations acts as success exit code (usually 0 unless customized).
                // If scanner fails (exit code != 0), we reject.
                // Note: sf scanner might exit with code 4 or similar if violations found.
                // We should check stdout first.
                // Actually, sf scanner exit codes: 0=No violations, 4=Violations found. 
                // So "error" might be present even if it worked.
                // We should resolve stdout if it's there.
                
                // For simplicity in this wrapper, if we get stdout, resolve it.
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
    console.log(`ℹ️  Service Version: 1.1 (Categories Enabled)`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
