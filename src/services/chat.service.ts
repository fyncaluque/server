import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { AIProvider, ChatAction, ChatContext, ChatMessage } from '../types';

dotenv.config();

const providers: Record<AIProvider, { client: () => any; model: string }> = {
  openai: {
    client: () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    model: 'gpt-4o',
  },
  gemini: {
    client: () => new GoogleGenerativeAI(process.env.GEMINI_API_KEY!),
    model: 'gemini-2.0-flash',
  },
  groq: {
    client: () =>
      new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      }),
    model: 'llama-3.3-70b-versatile',
  },
  openrouter: {
    client: () =>
      new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      }),
    model: 'meta-llama/llama-3.2-3b-instruct:free',
  },
};

function getDefaultProvider(): AIProvider {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OPENAI_API_KEY) return 'openai';
  throw new Error('No AI provider configured');
}

const DAY_MAP: Record<string, string> = {
  lunes: 'monday', L: 'monday',
  martes: 'tuesday', M: 'tuesday',
  miércoles: 'wednesday', miercoles: 'wednesday', X: 'wednesday',
  jueves: 'thursday', J: 'thursday',
  viernes: 'friday', V: 'friday',
  sábado: 'saturday', sabado: 'saturday', S: 'saturday',
  domingo: 'sunday', D: 'sunday',
};

function buildSystemPrompt(): string {
  return `Eres un asistente de horarios inteligente integrado en una aplicación de planificación semanal. Tu trabajo es interpretar instrucciones del usuario en español y devolver acciones estructuradas en JSON.

RESPONDE SIEMPRE con un JSON válido con esta estructura exacta:
{
  "response": "Tu respuesta conversacional al usuario en español, amigable y concisa",
  "actions": [
    {
      "type": "updateTimeRange|addActivity|removeActivity|updateProfile|conflict|refreshSchedule",
      "data": { ... }
    }
  ]
}

TIPOS DE ACCIONES:

1. updateTimeRange - Cambiar horario disponible (hora de despertar/dormir)
   { "type": "updateTimeRange", "data": { "wakeUpTime": "05:00", "bedTime": "22:00" } }

2. addActivity - Agregar una o más actividades
   { "type": "addActivity", "data": { "days": ["monday","tuesday"], "block": { "start": "19:00", "end": "20:00", "activity": "Estudio", "category": "learning", "energy": "high", "isFixed": true } } }

3. removeActivity - Eliminar actividades por nombre
   { "type": "removeActivity", "data": { "activityName": "Estudio" } }

4. updateProfile - Actualizar cualquier campo del perfil
   { "type": "updateProfile", "data": { "workStart": "09:00", "workEnd": "17:00" } }

5. conflict - Cuando hay un conflicto que requiere confirmación del usuario
   { "type": "conflict", "data": { "message": "Hay 2 actividades fuera del nuevo rango", "conflictingBlocks": [...], "pendingAction": { "type": "updateTimeRange", "data": {...} } } }

6. refreshSchedule - Indicar que el horario necesita regenerarse
   { "type": "refreshSchedule", "data": {} }

INTERPRETACIÓN DE DÍAS:
- "L a V" o "lunes a viernes" → ["monday","tuesday","wednesday","thursday","friday"]
- "L M X" → ["monday","tuesday","wednesday"]
- "fines de semana" → ["saturday","sunday"]
- "todos los días" → ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]

INTERPRETACIÓN DE HORAS:
- "7 a 8 pm" → start: "19:00", end: "20:00"
- "7am a 8am" → start: "07:00", end: "08:00"
- "14:00 a 15:30" → start: "14:00", end: "15:30"

CATEGORÍAS VÁLIDAS: sleep, morning_routine, exercise, work, meal, deep_work, learning, creative, social, wellness, leisure, chores, commute, break, evening_routine, free_time

ENERGY VÁLIDOS: high, medium, low

REGLAS:
- Si el usuario confirma una acción anterior (ej: "sí", "adelante", "ok"), ejecuta la acción pendiente del último conflicto.
- Si el usuario rechaza, responde amablemente sin acciones.
- Si no hay acciones que ejecutar, devuelve "actions": [] y solo responde conversacionalmente.
- NO incluyas texto fuera del JSON. SOLO JSON puro.`;
}

function buildUserPrompt(
  message: string,
  context: ChatContext,
  history: ChatMessage[]
): string {
  const historyText = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const profileSummary = `
PERFIL DEL USUARIO:
- Despierta: ${context.profile.wakeUpTime}
- Duerme: ${context.profile.bedTime}
- Trabajo: ${context.profile.workStart || 'N/A'} - ${context.profile.workEnd || 'N/A'} (${context.profile.workDays?.join(', ') || 'N/A'})
- Estilo de vida: ${context.profile.lifestyle}
- Objetivos: ${context.profile.goals?.join(', ') || 'Ninguno'}`;

  const scheduleSummary = context.schedule
    .map((day) => {
      const blocks = day.blocks
        .map((b) => `  ${b.start}-${b.end}: ${b.activity} (${b.category})`)
        .join('\n');
      return `\n${day.dayOfWeek.toUpperCase()} (${day.date}):\n${blocks || '  (sin actividades)'}`;
    })
    .join('\n');

  return `${profileSummary}

HORARIO ACTUAL:${scheduleSummary}

CONVERSACIÓN RECIENTE:
${historyText}

MENSAJE DEL USUARIO:
${message}`;
}

async function callGeminiForChat(systemPrompt: string, userPrompt: string): Promise<string> {
  const genAI = providers.gemini.client() as GoogleGenerativeAI;
  const model = genAI.getGenerativeModel({
    model: providers.gemini.model,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.5,
      maxOutputTokens: 2000,
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text) throw new Error('No response from Gemini');
  return text;
}

async function callOpenAICompatibleForChat(
  provider: AIProvider,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const config = providers[provider];
  const client = config.client() as OpenAI;

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response from ${provider}`);
  return content;
}

export interface ChatResult {
  response: string;
  actions: ChatAction[];
}

export async function interpretChatMessage(
  message: string,
  context: ChatContext,
  history: ChatMessage[],
  preferredProvider?: AIProvider
): Promise<ChatResult> {
  const provider = preferredProvider || getDefaultProvider();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(message, context, history);

  let raw: string;
  try {
    if (provider === 'gemini') {
      raw = await callGeminiForChat(systemPrompt, userPrompt);
    } else {
      raw = await callOpenAICompatibleForChat(provider, systemPrompt, userPrompt);
    }
  } catch {
    const fallback = provider === 'gemini' ? 'groq' : 'gemini';
    if (process.env[fallback.toUpperCase() + '_API_KEY']) {
      if (fallback === 'gemini') {
        raw = await callGeminiForChat(systemPrompt, userPrompt);
      } else {
        raw = await callOpenAICompatibleForChat(fallback, systemPrompt, userPrompt);
      }
    } else {
      throw new Error('AI provider failed');
    }
  }

  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);

  return {
    response: parsed.response || 'No pude procesar tu solicitud.',
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

export async function* streamChatResponse(
  message: string,
  context: ChatContext,
  history: ChatMessage[],
  preferredProvider?: AIProvider
): AsyncGenerator<{ type: 'token' | 'actions'; content?: string; data?: ChatAction[] }> {
  const result = await interpretChatMessage(message, context, history, preferredProvider);

  const words = result.response.split(' ');
  for (let i = 0; i < words.length; i++) {
    yield { type: 'token', content: words[i] + (i < words.length - 1 ? ' ' : '') };
    await new Promise((r) => setTimeout(r, 20));
  }

  yield { type: 'actions', data: result.actions };
}
