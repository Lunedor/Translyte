const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');

require('dotenv').config();

const TRANSLATION_PROVIDER = (process.env.TRANSLATION_PROVIDER || 'gemini').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';

const app = express();
const PORT = 3000;
const TRANSLATIONS_DIR = process.env.TRANSLATIONS_DIR
    ? path.resolve(process.env.TRANSLATIONS_DIR)
    : path.join(__dirname, 'translations');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// --- API ROUTES ---

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
    const { targetLanguage, baseTranslations, context, model } = req.body;
    if (!targetLanguage || !baseTranslations) {
        return res.status(400).json({ error: 'Missing target language or base translations.' });
    }
    const prompt = `Translate this JSON object to the language code "${targetLanguage}". Context: ${context}. IMPORTANT: Only return the raw, valid JSON object, with no markdown, comments, or other text. The JSON should have the exact same structure and keys as the source. Preserve HTML tags and placeholders like {{name}}. Terms: ${JSON.stringify(baseTranslations, null, 2)}`;

    try {
        let result;
        if (TRANSLATION_PROVIDER === 'gemini') {
            if (!GEMINI_API_KEY) {
                return res.status(500).json({ error: 'Server is not configured with a GEMINI_API_KEY in the .env file.' });
            }
            const geminiModel = model || GEMINI_MODEL;
            const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;
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
            result = data.candidates[0].content.parts[0].text;
            result = JSON.parse(result);
        } else if (TRANSLATION_PROVIDER === 'openai') {
            if (!OPENAI_API_KEY) {
                return res.status(500).json({ error: 'Server is not configured with an OPENAI_API_KEY in the .env file.' });
            }
            const openaiModel = model || OPENAI_MODEL;
            const openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
            const openaiResponse = await fetch(openaiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: openaiModel,
                    messages: [
                        { role: 'system', content: 'You are a professional translation engine.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 2048
                })
            });
            if (!openaiResponse.ok) { throw new Error(await openaiResponse.text()); }
            const data = await openaiResponse.json();
            let text = data.choices[0].message.content;
            // Remove markdown if present
            text = text.replace(/^```json|```$/g, '').trim();
            result = JSON.parse(text);
        } else if (TRANSLATION_PROVIDER === 'openrouter') {
            if (!OPENROUTER_API_KEY) {
                return res.status(500).json({ error: 'Server is not configured with an OPENROUTER_API_KEY in the .env file.' });
            }
            const openrouterModel = model || OPENROUTER_MODEL;
            const openrouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            const openrouterResponse = await fetch(openrouterApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`
                },
                body: JSON.stringify({
                    model: openrouterModel,
                    messages: [
                        { role: 'system', content: 'You are a professional translation engine.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 2048
                })
            });
            if (!openrouterResponse.ok) { throw new Error(await openrouterResponse.text()); }
            const data = await openrouterResponse.json();
            let text = data.choices[0].message.content;
            text = text.replace(/^```json|```$/g, '').trim();
            result = JSON.parse(text);
        } else {
            return res.status(400).json({ error: 'Invalid TRANSLATION_PROVIDER specified.' });
        }
        res.status(200).json(result);
    } catch (error) {
        console.error("[SERVER] AI Generation Error:", error.message);
        res.status(500).json({ error: `AI Generation Failed: ${error.message}` });
    }
});

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

// - START SERVER -
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`  Server started successfully at http://localhost:${PORT}`);
    console.log(`===================================================`);
});