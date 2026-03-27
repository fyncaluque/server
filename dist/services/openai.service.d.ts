import { AIProvider, GenerateScheduleRequest, GeneratedSchedule, ProviderInfo } from '../types';
export declare function getAvailableProviders(): ProviderInfo[];
export declare function generateSchedule(request: GenerateScheduleRequest): Promise<GeneratedSchedule & {
    provider: AIProvider;
}>;
export declare function regeneratePartial(request: GenerateScheduleRequest, timeRange: {
    start: string;
    end: string;
}, currentSchedule: GeneratedSchedule): Promise<GeneratedSchedule & {
    provider: AIProvider;
}>;
//# sourceMappingURL=openai.service.d.ts.map