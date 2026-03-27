"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildUserPrompt = buildUserPrompt;
function buildSystemPrompt() {
    return `Eres un planificador de horarios experto y coach de productividad personal. Tu rol es crear horarios diarios personalizados que maximicen el bienestar, la productividad y la satisfacción del usuario.

REGLAS ESTRICTAS:
1. NUNCA programes actividades de alta energía durante las horas de baja energía del usuario.
2. SIEMPRE respeta las horas de sueño - el horario empieza al despertar y termina a la hora de dormir.
3. Los compromisos fijos NO se pueden mover ni eliminar.
4. Incluye SIEMPRE bloques de descanso/pausas (mínimo 10-15 min entre actividades intensas).
5. Incluye las comidas en los horarios indicados por el usuario.
6. Si el usuario tiene objetivo de fitness, incluye al menos 30 min de ejercicio en su momento preferido.
7. Si el usuario tiene objetivo de wellness, incluye meditación o mindfulness.
8. Deja al menos 30 min de tiempo libre no estructurado.
9. Las actividades de trabajo profundo/estudio deben ir en horas de máxima energía.
10. No satures el horario - deja espacio para flexibilidad.
11. El horario debe cubrir TODO el rango despierto: desde wakeUpTime hasta bedTime, sin huecos largos sin asignar.
12. Si faltan minutos entre bloques, rellena con "break", "free_time" o una actividad ligera coherente.
13. Interpreta instrucciones cortas o coloquiales del usuario (ej: "Trabajo de 9 a 1, estudio en la noche, gym 3 veces").
14. Si el usuario menciona frecuencias (ej: "gym 3 veces", "estudiar 2 horas diarias"), debes respetarlas en la planificación del día que corresponda y mantener consistencia semanal al regenerar cada día.
15. Si hay conflicto entre instrucciones, prioriza compromisos fijos, salud (sueño/comidas) y luego objetivos.

INTERPRETACIÓN DE INSTRUCCIONES LIBRES:
- "Trabajo de 9 a 1" => bloque fijo o semirrígido de trabajo 09:00-13:00.
- "Estudio en la noche" => asignar bloque(s) de estudio en evening.
- "Gym 3 veces" => distribuir entrenamiento en días alternos, evitando días consecutivos si es posible.
- "Estudiar 2 horas diarias" => asegurar al menos 120 minutos de estudio por día.
- Si una instrucción no trae hora exacta, infiere el mejor horario según energía y contexto.

FORMATO DE RESPUESTA: Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "schedule": [
    {
      "start": "HH:MM",
      "end": "HH:MM",
      "activity": "Descripción de la actividad",
      "category": "sleep|morning_routine|exercise|work|meal|deep_work|learning|creative|social|wellness|leisure|chores|commute|break|evening_routine|free_time",
      "energy": "high|medium|low",
      "isFixed": true/false,
      "notes": "Nota opcional"
    }
  ],
  "suggestions": [
    {
      "activity": "Nombre de la actividad",
      "category": "categoría",
      "reason": "Por qué se sugiere esta actividad basado en el perfil del usuario",
      "duration": 30,
      "bestTimeOfDay": "morning|afternoon|evening",
      "energyRequired": "high|medium|low"
    }
  ],
  "tips": [
    "Consejo personalizado #1",
    "Consejo personalizado #2"
  ]
}

NO incluyas texto fuera del JSON. NO uses markdown. SOLO JSON puro.`;
}
function buildUserPrompt(request) {
    const { profile, date, dayOfWeek, customPrompt } = request;
    let prompt = `Genera un horario personalizado para el siguiente perfil de usuario:

--- DATOS DEL USUARIO ---

SUEÑO:
- Hora de despertar: ${profile.wakeUpTime}
- Hora de dormir: ${profile.bedTime}
- Horas de sueño deseadas: ${profile.sleepHours}

ENERGÍA:
- Horas de máxima energía: ${profile.peakEnergyStart} a ${profile.peakEnergyEnd}`;
    if (profile.lowEnergyStart && profile.lowEnergyEnd) {
        prompt += `\n- Horas de baja energía: ${profile.lowEnergyStart} a ${profile.lowEnergyEnd}`;
    }
    prompt += `\n\nESTILO DE VIDA: ${translateLifestyle(profile.lifestyle)}`;
    if (profile.workType) {
        prompt += `\nTIPO DE TRABAJO: ${translateWorkType(profile.workType)}`;
    }
    if (profile.workStart && profile.workEnd) {
        prompt += `\nHORARIO LABORAL: ${profile.workStart} a ${profile.workEnd}`;
    }
    if (profile.workDays && profile.workDays.length > 0) {
        prompt += `\nDÍAS LABORALES: ${profile.workDays.map(translateDay).join(', ')}`;
    }
    prompt += `\n\nOBJETIVOS: ${profile.goals.map(translateGoal).join(', ')}`;
    prompt += `\nINTERESES: ${profile.interests.map(translateInterest).join(', ')}`;
    if (profile.exercisePreference && profile.exercisePreference !== 'none') {
        prompt += `\nPREFERENCIA DE EJERCICIO: ${translateExercisePref(profile.exercisePreference)}`;
    }
    if (profile.mealTimes) {
        prompt += `\n\nHORAS DE COMIDA:`;
        prompt += `\n- Desayuno: ${profile.mealTimes.breakfast}`;
        prompt += `\n- Almuerzo: ${profile.mealTimes.lunch}`;
        prompt += `\n- Cena: ${profile.mealTimes.dinner}`;
    }
    if (profile.fixedCommitments && profile.fixedCommitments.length > 0) {
        prompt += `\n\nCOMPROMISOS FIJOS (NO MODIFICABLES):`;
        for (const commitment of profile.fixedCommitments) {
            const days = commitment.days.map(translateDay).join(', ');
            prompt += `\n- ${commitment.name}: ${commitment.start} a ${commitment.end} (${days}) [${commitment.category}]`;
        }
    }
    if (dayOfWeek) {
        prompt += `\n\nDÍA: ${translateDay(dayOfWeek)}`;
        const isWorkDay = profile.workDays.includes(dayOfWeek);
        prompt += ` (${isWorkDay ? 'día laboral' : 'día libre'})`;
    }
    if (date) {
        prompt += `\nFECHA: ${date}`;
    }
    if (customPrompt) {
        prompt += `\n\nINSTRUCCIONES ADICIONALES DEL USUARIO (LENGUAJE NATURAL):\n${customPrompt}`;
        prompt += `\n\nIMPORTANTE SOBRE ESTAS INSTRUCCIONES:
- Debes interpretar correctamente frases cortas y coloquiales.
- Convierte esas frases en restricciones concretas de horario (hora, duración, frecuencia, prioridad).
- Si el usuario pide cantidades o frecuencia (ej: "3 veces", "2 horas diarias"), respétalas explícitamente.
- Si faltan datos, infiere sin inventar contradicciones con el perfil.`;
    }
    prompt += `\n\n--- FIN DEL PERFIL ---

Genera el horario completo desde que el usuario despierta hasta que se va a dormir.
REQUISITO DE COBERTURA: no dejes huecos largos sin bloque entre wakeUpTime y bedTime.
Incluye al menos 5 sugerencias de actividades adicionales que el usuario podría agregar basándote en sus intereses y objetivos. Incluye 3 tips personalizados.`;
    return prompt;
}
// ========== Translation helpers ==========
function translateLifestyle(lifestyle) {
    const map = {
        active: 'Activo (hace ejercicio regularmente, le gusta moverse)',
        sedentary: 'Sedentario (trabajo de escritorio, poca actividad física)',
        balanced: 'Equilibrado (actividad moderada)',
    };
    return map[lifestyle] || lifestyle;
}
function translateWorkType(workType) {
    const map = {
        remote: 'Remoto (trabaja desde casa)',
        office: 'Oficina (va a un lugar de trabajo)',
        hybrid: 'Híbrido (combinación de remoto y oficina)',
        student: 'Estudiante',
        freelance: 'Freelance/Independiente',
    };
    return map[workType] || workType;
}
function translateDay(day) {
    const map = {
        monday: 'Lunes',
        tuesday: 'Martes',
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes',
        saturday: 'Sábado',
        sunday: 'Domingo',
    };
    return map[day] || day;
}
function translateGoal(goal) {
    const map = {
        productivity: 'Productividad',
        fitness: 'Fitness/Ejercicio',
        wellness: 'Bienestar/Salud mental',
        learning: 'Aprendizaje/Crecimiento',
        social: 'Vida social',
        creativity: 'Creatividad',
    };
    return map[goal] || goal;
}
function translateInterest(interest) {
    const map = {
        exercise: 'Ejercicio',
        meditation: 'Meditación',
        reading: 'Lectura',
        cooking: 'Cocina',
        music: 'Música',
        gaming: 'Videojuegos',
        socializing: 'Socializar',
        nature: 'Naturaleza/Aire libre',
        arts: 'Artes',
        languages: 'Idiomas',
    };
    return map[interest] || interest;
}
function translateExercisePref(pref) {
    const map = {
        morning: 'Por la mañana',
        afternoon: 'Por la tarde',
        evening: 'Por la noche',
    };
    return map[pref] || pref;
}
//# sourceMappingURL=prompt-builder.js.map