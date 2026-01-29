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

// AI Init
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
        const version = await exec(PMD_BINARY, ["--version"]);
        pmdStatus = `available (${version.trim()})`;
    } catch (error) {
        pmdStatus = 'not available: ' + error.message;
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

// POST /analyze - Batch Scan (Fixed for LWC)
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
        
        // Write files
        for (const cls of classes) {
            const fileName = cls.name.endsWith('.cls') ? cls.name : `${cls.name}.cls`;
            await fs.writeFile(path.join(tmpDir, fileName), cls.source, "utf8");
        }
        
        console.log(`🚀 Executing PMD on ${classes.length} files...`);
        
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
                
                if (parsed.files) {
                    parsed.files.forEach(file => {
                        // Clean up filename (remove /tmp/ path and .cls extension)
                        const baseName = path.basename(file.filename).replace('.cls', '');
                        
                        file.violations.forEach(v => {
                            // --- FIX: MAP FIELDS EXACTLY TO LWC COLUMNS ---
                            violations.push({
                                id: `${baseName}-${v.beginline}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID for key-field
                                className: baseName,        // Matches 'fieldName': 'className'
                                line: v.beginline,          // Matches 'fieldName': 'line' (was beginline)
                                rule: v.rule,               // Matches 'fieldName': 'rule'
                                message: v.description,     // Matches 'fieldName': 'message' (was description)
                                severity: v.priority,       // Matches 'fieldName': 'severity' (was priority)
                                isFixDisabled: false
                            });
                        });
                    });
                }
            }
        } catch (e) {
            console.error("JSON Parse Error:", e);
        }
        
        // --- FIX: RETURN ARRAY DIRECTLY (Not wrapped in object) ---
        res.json(violations);
        
    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: error.message });
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

// Utility
function exec(bin, args) {
    return new Promise((resolve, reject) => {
        execFile(bin, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout; 
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Service running on ${PORT}`));