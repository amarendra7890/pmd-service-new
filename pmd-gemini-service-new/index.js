import 'dotenv/config';
import express from "express";
import { execFile } from "child_process";
import { v4 as uuid } from "uuid";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import path from 'path';

const app = express();
app.use(express.json({ limit: "50mb" }));

// Standard PMD Rulesets
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

// AI Initialization
let ai;
const initializeGemini = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        try {
            ai = new GoogleGenAI({ apiKey });
            console.log("✅ Gemini AI initialized");
        } catch (error) {
            console.error("❌ Gemini Error:", error.message);
        }
    } else {
        console.log("⚠️ Gemini API key missing");
    }
};
initializeGemini();

// Health Check
app.get("/health", async (req, res) => {
    let pmdStatus = 'unknown';
    try {
        console.log("Health check: Testing PMD binary...");
        const version = await exec(PMD_BINARY, ["--version"]);
        pmdStatus = `available (${version.trim()})`;
        console.log("Health check: PMD is working.");
    } catch (error) {
        console.error("Health check failed:", error);
        pmdStatus = 'not available: ' + (error.stderr || error.message);
    }
    res.json({ 
        status: "ok", 
        mode: "Native PMD (High Performance)",
        pmdStatus
    });
});

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') res.sendStatus(200);
    else next();
});

// POST /analyze - Batch Scan
app.post("/analyze", async (req, res) => {
    req.setTimeout(120000);
    
    try {
        console.log("🔍 Received batch scan request");
        const { classes } = req.body;
        
        if (!classes || !Array.isArray(classes)) {
            return res.status(400).json({ error: "Invalid payload" });
        }

        const tmpDir = `/tmp/${uuid()}`;
        await fs.mkdir(tmpDir, { recursive: true });
        console.log(`📁 Created temp dir: ${tmpDir}`);
        
        // Write files
        for (const cls of classes) {
            const fileName = cls.name.endsWith('.cls') ? cls.name : `${cls.name}.cls`;
            await fs.writeFile(path.join(tmpDir, fileName), cls.source, "utf8");
        }
        
        console.log(`🚀 Executing PMD on ${classes.length} files...`);
        
        let pmdOutput = "";
        try {
            // Running PMD
            pmdOutput = await exec(PMD_BINARY, [
                "check",
                "--dir", tmpDir,
                "--format", "json",
                "--rulesets", PMD_RULESETS,
                "--no-cache"
            ]);
            console.log("✅ PMD execution completed successfully (Exit Code 0).");
        } catch (err) {
            // Check for exit code 4 (Violations found) which is NOT a crash
            if (err.code === 4) {
                console.log("⚠️ PMD finished with violations (Exit Code 4). This is normal.");
                pmdOutput = err.stdout;
            } else {
                console.error("❌ PMD CRASHED OR FAILED!");
                console.error("Exit Code:", err.code);
                console.error("STDERR (Errors):", err.stderr);
                console.error("STDOUT (Output):", err.stdout);
                throw new Error(`PMD Failed: ${err.stderr || err.message}`);
            }
        }
        
        // Clean up
        await fs.rm(tmpDir, { recursive: true, force: true });
        console.log("🧹 Temp files cleaned up.");
        
        let violations = [];
        try {
            if (pmdOutput && pmdOutput.trim()) {
                console.log("📊 Parsing PMD JSON output...");
                const parsed = JSON.parse(pmdOutput);
                
                if (parsed.files) {
                    parsed.files.forEach(file => {
                        const baseName = path.basename(file.filename).replace('.cls', '');
                        
                        file.violations.forEach((v, index) => {
                            violations.push({
                                id: `${baseName}-${v.beginline}-${index}`, 
                                className: baseName,        
                                line: v.beginline,          
                                rule: v.rule,               
                                message: v.description,     
                                severity: v.priority,       
                                isFixDisabled: false
                            });
                        });
                    });
                }
                console.log(`✅ Found ${violations.length} violations.`);
            } else {
                console.log("✅ No output from PMD (No violations found).");
            }
        } catch (e) {
            console.error("❌ JSON Parse Error:", e);
            console.error("Raw Output was:", pmdOutput);
        }
        
        res.json(violations);
        
    } catch (error) {
        console.error("❌ Server Error Handler:", error);
        res.status(500).json({ 
            error: error.message,
            details: "Check server logs for STDERR output"
        });
    }
});

// POST /fix - AI Suggestions
app.post("/fix", async (req, res) => {
    req.setTimeout(30000);
    try {
        const { prompt, code } = req.body;
        if (!ai) return res.status(503).json({ error: "AI not available" });

        const fullPrompt = `Fix this Apex code PMD violation: "${prompt}"
CODE:
\`\`\`apex
${code}
\`\`\`
Provide: 1. Fixed code (concise). 2. Brief explanation. Keep under 200 words.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: fullPrompt
        });
        
        res.json({ patch: response.text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------
// DEBUGGING UTILITY: EXEC
// ---------------------------------------------------------
function exec(bin, args) {
    return new Promise((resolve, reject) => {
        console.log(`[DEBUG] Spawning process: ${bin} ${args.join(' ')}`);
        
        // Added 60 second timeout to prevent hanging forever
        execFile(bin, args, { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }, (error, stdout, stderr) => {
            if (stderr) {
                console.log(`[DEBUG] Process STDERR: ${stderr}`); // Log warnings/errors from Java
            }
            
            if (error) {
                // Attach stdout/stderr to error object so we can use it later
                error.stdout = stdout; 
                error.stderr = stderr;
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Service running on ${PORT}`));