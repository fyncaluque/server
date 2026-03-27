export interface MealTimes {
    breakfast: string;
    lunch: string;
    dinner: string;
}
export interface FixedCommitment {
    name: string;
    start: string;
    end: string;
    days: string[];
    category: string;
}
export type Lifestyle = 'active' | 'sedentary' | 'balanced';
export type WorkType = 'remote' | 'office' | 'hybrid' | 'student' | 'freelance';
export type ExercisePreference = 'morning' | 'afternoon' | 'evening' | 'none';
export type Goal = 'productivity' | 'fitness' | 'wellness' | 'learning' | 'social' | 'creativity';
export type Interest = 'exercise' | 'meditation' | 'reading' | 'cooking' | 'music' | 'gaming' | 'socializing' | 'nature' | 'arts' | 'languages';
export interface UserProfile {
    id?: string;
    authId?: string;
    email?: string;
    name?: string;
    wakeUpTime: string;
    bedTime: string;
    sleepHours: number;
    peakEnergyStart: string;
    peakEnergyEnd: string;
    lowEnergyStart?: string;
    lowEnergyEnd?: string;
    lifestyle: Lifestyle;
    workType?: WorkType;
    workStart?: string;
    workEnd?: string;
    workDays: string[];
    goals: Goal[];
    interests: Interest[];
    exercisePreference?: ExercisePreference;
    mealTimes?: MealTimes;
    fixedCommitments?: FixedCommitment[];
}
export type BlockCategory = 'sleep' | 'morning_routine' | 'exercise' | 'work' | 'meal' | 'deep_work' | 'learning' | 'creative' | 'social' | 'wellness' | 'leisure' | 'chores' | 'commute' | 'break' | 'evening_routine' | 'free_time';
export type EnergyLevel = 'high' | 'medium' | 'low';
export interface ScheduleBlock {
    start: string;
    end: string;
    activity: string;
    category: BlockCategory;
    energy: EnergyLevel;
    isFixed: boolean;
    notes?: string;
}
export interface ActivitySuggestion {
    activity: string;
    category: BlockCategory;
    reason: string;
    duration: number;
    bestTimeOfDay: string;
    energyRequired: EnergyLevel;
}
export interface GeneratedSchedule {
    schedule: ScheduleBlock[];
    suggestions: ActivitySuggestion[];
    tips: string[];
}
export type AIProvider = 'openai' | 'gemini' | 'groq' | 'openrouter';
export interface GenerateScheduleRequest {
    profile: UserProfile;
    date?: string;
    dayOfWeek?: string;
    customPrompt?: string;
    provider?: AIProvider;
}
export interface ProviderInfo {
    id: AIProvider;
    name: string;
    model: string;
    isFree: boolean;
    description: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map