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
  return `Eres un asistente de tiempo inteligente. Tu trabajo es ayudar al usuario a organizar su tiempo, crear planes de estudio/ejercicio/rutinas, y optimizar su horario semanal.

RESPONDE SIEMPRE con un JSON válido:
{
  "response": "Tu respuesta conversacional en español, amigable y concisa",
  "actions": [
    { "type": "tipo_accion", "data": { ... } }
  ]
}

ACCIONES DISPONIBLES:

1. updateTimeRange - Cambiar horario disponible
   { "type": "updateTimeRange", "data": { "wakeUpTime": "05:00", "bedTime": "22:00" } }

2. addActivity - Agregar actividades específicas a días
   { "type": "addActivity", "data": { "days": ["monday","tuesday"], "block": { "start": "19:00", "end": "20:00", "activity": "Estudio de cálculo", "category": "learning", "energy": "high", "isFixed": true } } }

3. removeActivity - Eliminar actividades por nombre
   { "type": "removeActivity", "data": { "activityName": "Estudio" } }

4. updateProfile - Actualizar perfil
   { "type": "updateProfile", "data": { "workStart": "09:00", "workEnd": "17:00" } }

5. deleteSchedule - Eliminar horario semanal
   { "type": "deleteSchedule", "data": {} }

6. generatePlan - GENERAR PLANES DE ESTUDIO/LECTURA/APRENDIZAJE
   Cuando el usuario expresa un objetivo de aprendizaje/estudio con cantidad o tiempo:
   - Calcula distribución óptima (días, duración, frecuencia)
   - Genera bloques con progreso/tracking
   - Usa planId para agrupar los bloques del plan
   
   Ejemplo "Quiero leer 5 libros este mes":
   { "type": "generatePlan", "data": {
       "planId": "reading-5books-march",
       "name": "Plan de lectura: 5 libros",
       "goal": "Leer 5 libros en marzo",
       "blocks": [
         { "days": ["monday","wednesday","friday"], "start": "19:00", "end": "19:30", "activity": "📖 Lectura - Libro 1/5", "category": "learning", "energy": "medium", "isFixed": false, "notes": "~30 páginas/día", "planProgress": { "label": "Libro 1/5", "milestone": "Cap. 1-3" } }
       ],
       "tips": ["Lee a la misma hora cada día para crear hábito", "30 páginas/día = 1 libro por semana"]
   }}

7. generateRoutine - GENERAR RUTINAS DE EJERCICIO/BIENESTAR
   Cuando el usuario quiere una rutina de ejercicio o bienestar:
   - Selecciona ejercicios/actividades apropiados
   - Distribuye según días disponibles y energía
   - Genera bloques con progreso
   
   Ejemplo "Quiero hacer ejercicio 3 veces por semana":
   { "type": "generateRoutine", "data": {
       "planId": "exercise-3x-week",
       "name": "Rutina de ejercicio 3x/semana",
       "goal": "Hacer ejercicio 3 veces por semana",
       "blocks": [
         { "days": ["monday"], "start": "07:00", "end": "07:45", "activity": "🏋️ Cardio + Abdominales", "category": "exercise", "energy": "high", "isFixed": false, "planProgress": { "label": "Día 1/3", "milestone": "Cardio 30min + Abs 15min" } },
         { "days": ["wednesday"], "start": "07:00", "end": "07:45", "activity": "🏋️ Fuerza - Tren superior", "category": "exercise", "energy": "high", "isFixed": false, "planProgress": { "label": "Día 2/3", "milestone": "Pecho, espalda, brazos" } },
         { "days": ["friday"], "start": "07:00", "end": "07:45", "activity": "🏋️ Fuerza - Tren inferior", "category": "exercise", "energy": "high", "isFixed": false, "planProgress": { "label": "Día 3/3", "milestone": "Piernas, glúteos" } }
       ],
       "tips": ["Descansa al menos 1 día entre sesiones de fuerza"]
   }}

8. suggestForFreeTime - Sugerir actividades para tiempo libre
   Usa las favoriteActivities del perfil para sugerir qué hacer en tiempos libres.
   { "type": "suggestForFreeTime", "data": { "time": "16:00", "suggestions": ["⚽ Fútbol con amigos", "📚 Leer 20 páginas", "🧘 Yoga relajante"] } }

9. conflict - Pedir confirmación al usuario
   { "type": "conflict", "data": { "message": "Hay actividades fuera del nuevo rango", "pendingAction": { ... } } }

10. refreshSchedule - Indicar que el horario debe actualizarse
    { "type": "refreshSchedule", "data": {} }

FORMATO DE BLOQUES:
Cada bloque debe tener: start, end, activity, category, energy, isFixed
Opcionalmente: notes, planId, planProgress: { label, milestone }

CATEGORÍAS: sleep, morning_routine, exercise, work, meal, deep_work, learning, creative, social, wellness, leisure, chores, commute, break, evening_routine, free_time
ENERGY: high, medium, low

INTERPRETACIÓN DE DÍAS:
- "L a V" / "lunes a viernes" → ["monday","tuesday","wednesday","thursday","friday"]
- "L M X" → ["monday","tuesday","wednesday"]
- "fines de semana" → ["saturday","sunday"]
- "todos los días" → los 7 días

INTERPRETACIÓN DE HORAS:
- "7 a 8 pm" → 19:00-20:00
- "7am a 8am" → 07:00-08:00

REGLAS IMPORTANTES:
- RESTRICCIÓN DE HORARIO: TODOS los bloques DEBEN estar dentro del rango availableStart - availableEnd del usuario. NUNCA generes bloques fuera de este rango.
- Si el usuario pide una actividad fuera del rango, informa que no es posible y sugiere alternativas dentro del rango.
- Si el usuario expresa un OBJETIVO con cantidad (X libros, X veces, X horas), usa generatePlan o generateRoutine
- Si es solo un compromiso puntual (trabajo L-V 9-5), usa addActivity
- Usa las favoriteActivities del perfil al sugerir tiempo libre
- Siempre calcula la distribución óptima considerando descanso y energía
- Los bloques de plan NO son fijos (isFixed: false) - el usuario puede moverlos
- Si no hay acciones, devuelve "actions": []
- SOLO JSON puro, sin markdown.`;
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
- ⚠️ HORARIO DISPONIBLE (LÍMITE ABSOLUTO): ${context.profile.wakeUpTime} a ${context.profile.bedTime}
  → TODOS los bloques DEBEN estar entre ${context.profile.wakeUpTime} y ${context.profile.bedTime}
- Despierta: ${context.profile.wakeUpTime}
- Duerme: ${context.profile.bedTime}
- Trabajo: ${context.profile.workStart || 'N/A'} - ${context.profile.workEnd || 'N/A'} (${context.profile.workDays?.join(', ') || 'N/A'})
- Estilo de vida: ${context.profile.lifestyle}
- Objetivos: ${context.profile.goals?.join(', ') || 'Ninguno'}
- Intereses/Favoritos: ${context.profile.interests?.join(', ') || 'Ninguno'}
- Ejercicio preferido: ${context.profile.exercisePreference || 'N/A'}`;

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
      maxOutputTokens: 4000,
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
    max_tokens: 4000,
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
