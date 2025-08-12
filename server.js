// server.js - Corrected with Regex Routes
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');

require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
const PORT = 3000;
const TRANSLATIONS_DIR = path.join(__dirname, 'translations');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// --- API ROUTES (Verified Syntax) ---

// FIX: Using a regular expression to match the GET route.
app.get(/\/api\/translations\/(.*)/, async (req, res) => {
    try {
        // The captured path is in req.params[0] when using a regex.
        const requestedPath = req.params[0];
        const fullPath = path.join(TRANSLATIONS_DIR, requestedPath);

        if (!fullPath.startsWith(TRANSLATIONS_DIR) || !requestedPath) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        await fs.access(fullPath);
        res.sendFile(fullPath);
    } catch (error) {
        res.status(404).json({ error: `Not Found` });
    }
});

app.post('/api/generate-translation', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server is not configured with a GEMINI_API_KEY in the .env file.' });
    }
    const { targetLanguage, baseTranslations, context } = req.body;
    if (!targetLanguage || !baseTranslations) {
        return res.status(400).json({ error: 'Missing target language or base translations.' });
    }
    const prompt = `Translate this JSON object to the language code "${targetLanguage}". Context: ${context}. IMPORTANT: Only return the raw, valid JSON object, with no markdown, comments, or other text. The JSON should have the exact same structure and keys as the source. Preserve HTML tags and placeholders like {{name}}. Terms: ${JSON.stringify(baseTranslations, null, 2)}`;
    try {
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" },
            }),
        });
        if (!geminiResponse.ok) { throw new Error(await geminiResponse.text()); }
        const data = await geminiResponse.json();
        const parsedTranslations = data.candidates[0].content.parts[0].text;
        res.status(200).json(JSON.parse(parsedTranslations));
    } catch (error) {
        console.error("[SERVER] AI Generation Error:", error.message);
        res.status(500).json({ error: `AI Generation Failed: ${error.message}` });
    }
});

// FIX: Using a regular expression to match the POST route.
app.post(/\/api\/translations\/(.*)/, async (req, res) => {
    try {
        // The captured path is in req.params[0].
        const requestedPath = req.params[0];
        const data = req.body;
        const fullPath = path.join(TRANSLATIONS_DIR, requestedPath);

        if (!fullPath.startsWith(TRANSLATIONS_DIR) || !requestedPath) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const directoryPath = path.dirname(fullPath);
        await fs.mkdir(directoryPath, { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
        console.log(`[SUCCESS] Wrote file: ${requestedPath}`);
        res.status(201).json({ message: `File saved successfully.` });
    } catch (error) {
        console.error('[ERROR] Failed to write translation file:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`  Server started successfully at http://localhost:${PORT}`);
    console.log(`===================================================`);
});