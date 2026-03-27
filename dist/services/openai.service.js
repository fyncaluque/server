"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableProviders = getAvailableProviders;
exports.generateSchedule = generateSchedule;
exports.regeneratePartial = regeneratePartial;
const openai_1 = __importDefault(require("openai"));
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
const prompt_builder_1 = require("../utils/prompt-builder");
dotenv_1.default.config();
// ========== Provider Configs ==========
const providers = {
    openai: {
        client: () => new openai_1.default({ apiKey: process.env.OPENAI_API_KEY }),
        model: 'gpt-4o',
    },
    gemini: {
        client: () => new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY),
        model: 'gemini-2.0-flash',
    },
    groq: {
        client: () => new openai_1.default({
            apiKey: process.env.GROQ_API_KEY,
            baseURL: 'https://api.groq.com/openai/v1',
        }),
        model: 'llama-3.3-70b-versatile',
    },
    openrouter: {
        client: () => new openai_1.default({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
        }),
        model: 'meta-llama/llama-3.2-3b-instruct:free',
    },
};
// ========== Available Providers Info ==========
function getAvailableProviders() {
    const available = [];
    if (process.env.GEMINI_API_KEY) {
        available.push({
            id: 'gemini',
            name: 'Google Gemini',
            model: 'Gemini 2.0 Flash',
            isFree: true,
            description: 'Mejor modelo gratuito. Rápido y preciso con JSON estructurado.',
        });
    }
    if (process.env.GROQ_API_KEY) {
        available.push({
            id: 'groq',
            name: 'Groq',
            model: 'Llama 3.3 70B',
            isFree: true,
            description: 'Inferencia ultrarrápida. Gratis con límites de 30 req/min.',
        });
    }
    if (process.env.OPENROUTER_API_KEY) {
        available.push({
            id: 'openrouter',
            name: 'OpenRouter',
            model: 'Llama 3.2 3B (Free)',
            isFree: true,
            description: 'Acceso a múltiples modelos gratuitos. ~20 req/día sin créditos.',
        });
    }
    if (process.env.OPENAI_API_KEY) {
        available.push({
            id: 'openai',
            name: 'OpenAI',
            model: 'GPT-4o',
            isFree: false,
            description: 'Mejor calidad. Requiere API key de pago.',
        });
    }
    return available;
}
function getDefaultProvider() {
    if (process.env.GEMINI_API_KEY)
        return 'gemini';
    if (process.env.GROQ_API_KEY)
        return 'groq';
    if (process.env.OPENROUTER_API_KEY)
        return 'openrouter';
    if (process.env.OPENAI_API_KEY)
        return 'openai';
    throw new Error('No AI provider configured. Set at least one API key in .env');
}
// ========== Gemini-specific call ==========
async function callGemini(systemPrompt, userPrompt) {
    const genAI = providers.gemini.client();
    const model = genAI.getGenerativeModel({
        model: providers.gemini.model,
        systemInstruction: systemPrompt,
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            maxOutputTokens: 4000,
        },
    });
    const result = await model.generateContent(userPrompt);
    const text = result.response.text();
    if (!text) {
        throw new Error('No response received from Gemini');
    }
    return text;
}
// ========== OpenAI-compatible call (OpenAI, Groq, OpenRouter) ==========
async function callOpenAICompatible(provider, systemPrompt, userPrompt, maxTokens = 4000) {
    const config = providers[provider];
    const client = config.client();
    const response = await client.chat.completions.create({
        model: config.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: maxTokens,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
        throw new Error(`No response received from ${provider}`);
    }
    return content;
}
// ========== Unified call ==========
async function callProvider(provider, systemPrompt, userPrompt, maxTokens = 4000) {
    if (provider === 'gemini') {
        return callGemini(systemPrompt, userPrompt);
    }
    return callOpenAICompatible(provider, systemPrompt, userPrompt, maxTokens);
}
// ========== Parse & validate ==========
function parseAndValidate(content) {
    // Some models wrap JSON in markdown code blocks - strip them
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
    }
    else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.schedule || !Array.isArray(parsed.schedule)) {
        throw new Error('Invalid schedule format returned by AI');
    }
    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        parsed.suggestions = [];
    }
    if (!parsed.tips || !Array.isArray(parsed.tips)) {
        parsed.tips = [];
    }
    // Sort schedule blocks by start time
    parsed.schedule.sort((a, b) => a.start.localeCompare(b.start));
    // Warn on overlaps
    for (let i = 1; i < parsed.schedule.length; i++) {
        const prev = parsed.schedule[i - 1];
        const curr = parsed.schedule[i];
        if (curr.start < prev.end) {
            console.warn(`Schedule overlap detected: "${prev.activity}" (${prev.end}) overlaps with "${curr.activity}" (${curr.start})`);
        }
    }
    return parsed;
}
// ========== Provider Fallback ==========
function getAvailableProviderIds() {
    const order = ['gemini', 'groq', 'openrouter', 'openai'];
    return order.filter((id) => {
        if (id === 'gemini')
            return !!process.env.GEMINI_API_KEY;
        if (id === 'groq')
            return !!process.env.GROQ_API_KEY;
        if (id === 'openrouter')
            return !!process.env.OPENROUTER_API_KEY;
        if (id === 'openai')
            return !!process.env.OPENAI_API_KEY;
        return false;
    });
}
async function tryWithFallback(callFn, preferredProvider) {
    const available = getAvailableProviderIds();
    if (available.length === 0) {
        throw new Error('No AI provider configured. Set at least one API key in .env');
    }
    const order = preferredProvider && available.includes(preferredProvider)
        ? [preferredProvider, ...available.filter((p) => p !== preferredProvider)]
        : available;
    if (preferredProvider) {
        console.log(`Trying user-selected provider: ${preferredProvider}`);
    }
    const errors = [];
    for (const provider of order) {
        try {
            console.log(`Trying provider: ${provider}`);
            const content = await callFn(provider);
            console.log(`Provider ${provider} succeeded`);
            return { content, provider };
        }
        catch (err) {
            const msg = `${provider}: ${err.status || ''} ${err.message || err}`.trim();
            console.warn(`Provider ${provider} failed — ${msg}`);
            errors.push(msg);
        }
    }
    throw new Error(`All providers failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
}
// ========== Public API ==========
async function generateSchedule(request) {
    const systemPrompt = (0, prompt_builder_1.buildSystemPrompt)();
    const userPrompt = (0, prompt_builder_1.buildUserPrompt)(request);
    const { content, provider } = await tryWithFallback((p) => callProvider(p, systemPrompt, userPrompt), request.provider);
    const parsed = parseAndValidate(content);
    return { ...parsed, provider };
}
async function regeneratePartial(request, timeRange, currentSchedule) {
    const systemPrompt = (0, prompt_builder_1.buildSystemPrompt)();
    const existingBlocks = currentSchedule.schedule
        .filter((b) => b.end <= timeRange.start || b.start >= timeRange.end)
        .map((b) => `  ${b.start}-${b.end}: ${b.activity} (${b.category})`)
        .join('\n');
    const userPrompt = `${(0, prompt_builder_1.buildUserPrompt)(request)}

IMPORTANTE: Solo necesito regenerar el horario entre ${timeRange.start} y ${timeRange.end}.

Los siguientes bloques YA ESTÁN FIJOS y NO deben cambiar:
${existingBlocks}

Genera SOLO los bloques para el rango ${timeRange.start}-${timeRange.end}, manteniendo la misma estructura JSON.`;
    const { content, provider } = await tryWithFallback((p) => callProvider(p, systemPrompt, userPrompt, 2000), request.provider);
    const partial = parseAndValidate(content);
    const keptBlocks = currentSchedule.schedule.filter((b) => b.end <= timeRange.start || b.start >= timeRange.end);
    const merged = {
        schedule: [...keptBlocks, ...partial.schedule].sort((a, b) => a.start.localeCompare(b.start)),
        suggestions: partial.suggestions || currentSchedule.suggestions,
        tips: partial.tips || currentSchedule.tips,
    };
    return { ...merged, provider };
}
//# sourceMappingURL=openai.service.js.map