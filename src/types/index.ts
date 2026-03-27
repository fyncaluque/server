// ========== Profile Types ==========

export interface MealTimes {
  breakfast: string;
  lunch: string;
  dinner: string;
}

export interface FixedCommitment {
  name: string;
  start: string; // "09:00"
  end: string;   // "17:00"
  days: string[]; // ["monday", "tuesday"]
  category: string; // "work" | "study" | "personal"
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

  // Sleep
  wakeUpTime: string;
  bedTime: string;
  sleepHours: number;

  // Energy
  peakEnergyStart: string;
  peakEnergyEnd: string;
  lowEnergyStart?: string;
  lowEnergyEnd?: string;

  // Lifestyle
  lifestyle: Lifestyle;
  workType?: WorkType;
  workStart?: string;
  workEnd?: string;
  workDays: string[];

  // Preferences
  goals: Goal[];
  interests: Interest[];
  exercisePreference?: ExercisePreference;
  mealTimes?: MealTimes;

  // Fixed commitments
  fixedCommitments?: FixedCommitment[];
}

// ========== Schedule Types ==========

export type BlockCategory =
  | 'sleep'
  | 'morning_routine'
  | 'exercise'
  | 'work'
  | 'meal'
  | 'deep_work'
  | 'learning'
  | 'creative'
  | 'social'
  | 'wellness'
  | 'leisure'
  | 'chores'
  | 'commute'
  | 'break'
  | 'evening_routine'
  | 'free_time';

export type EnergyLevel = 'high' | 'medium' | 'low';

export interface ScheduleBlock {
  start: string;    // "06:00"
  end: string;      // "06:30"
  activity: string; // "Despertar + rutina matutina"
  category: BlockCategory;
  energy: EnergyLevel;
  isFixed: boolean; // true if it's a user-defined commitment
  notes?: string;
}

export interface ActivitySuggestion {
  activity: string;
  category: BlockCategory;
  reason: string;
  duration: number; // minutes
  bestTimeOfDay: string; // "morning" | "afternoon" | "evening"
  energyRequired: EnergyLevel;
}

export interface GeneratedSchedule {
  schedule: ScheduleBlock[];
  suggestions: ActivitySuggestion[];
  tips: string[];
}

// ========== API Types ==========

export type AIProvider = 'openai' | 'gemini' | 'groq' | 'openrouter';

export interface GenerateScheduleRequest {
  profile: UserProfile;
  date?: string;        // "2026-03-27"
  dayOfWeek?: string;   // "friday"
  customPrompt?: string; // additional user instructions
  provider?: AIProvider; // which AI provider to use
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
