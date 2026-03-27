"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_middleware_1 = require("../middleware/auth.middleware");
const openai_service_1 = require("../services/openai.service");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// POST /api/schedule/generate - Generate a new schedule
router.post('/generate', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { customPrompt, date, provider } = req.body;
        // Get user profile
        const profile = await prisma.profile.findUnique({
            where: { authId: req.userId },
        });
        if (!profile) {
            res.status(400).json({
                success: false,
                error: 'Please complete your profile first before generating a schedule.',
            });
            return;
        }
        const profileData = {
            wakeUpTime: profile.wakeUpTime,
            bedTime: profile.bedTime,
            sleepHours: profile.sleepHours,
            peakEnergyStart: profile.peakEnergyStart,
            peakEnergyEnd: profile.peakEnergyEnd,
            lowEnergyStart: profile.lowEnergyStart ?? undefined,
            lowEnergyEnd: profile.lowEnergyEnd ?? undefined,
            lifestyle: profile.lifestyle,
            workType: profile.workType ?? undefined,
            workStart: profile.workStart ?? undefined,
            workEnd: profile.workEnd ?? undefined,
            workDays: profile.workDays,
            goals: profile.goals,
            interests: profile.interests,
            exercisePreference: profile.exercisePreference ?? undefined,
            mealTimes: profile.mealTimes ?? undefined,
            fixedCommitments: profile.fixedCommitments ?? undefined,
        };
        const baseDate = date ? new Date(date) : new Date();
        const weekDates = getWeekDates(baseDate);
        const weekStart = weekDates[0].date;
        const weekEnd = weekDates[6].date;
        const generatedWeek = [];
        for (const day of weekDates) {
            const request = {
                profile: profileData,
                date: day.date,
                dayOfWeek: day.dayOfWeek,
                customPrompt,
                provider: provider,
            };
            const generated = await (0, openai_service_1.generateSchedule)(request);
            generatedWeek.push({
                date: day.date,
                dayOfWeek: day.dayOfWeek,
                schedule: generated.schedule,
                suggestions: generated.suggestions,
                tips: generated.tips,
                provider: generated.provider,
            });
        }
        const weekStartDate = new Date(weekStart);
        const weekEndDate = new Date(weekEnd);
        const savedWeek = await prisma.$transaction(async (tx) => {
            await tx.schedule.deleteMany({
                where: {
                    profileId: profile.id,
                    date: {
                        gte: weekStartDate,
                        lte: weekEndDate,
                    },
                },
            });
            const createdDays = [];
            for (const day of generatedWeek) {
                const created = await tx.schedule.create({
                    data: {
                        profileId: profile.id,
                        date: new Date(day.date),
                        dayOfWeek: day.dayOfWeek,
                        blocks: day.schedule,
                        suggestions: day.suggestions,
                        metadata: {
                            provider: day.provider,
                            generatedAt: new Date().toISOString(),
                            customPrompt: customPrompt || null,
                            tips: day.tips,
                            weekStart,
                            weekEnd,
                        },
                    },
                });
                createdDays.push({
                    id: created.id,
                    date: created.date.toISOString(),
                    dayOfWeek: created.dayOfWeek,
                    schedule: day.schedule,
                    suggestions: day.suggestions,
                    tips: day.tips,
                    provider: day.provider,
                });
            }
            return createdDays;
        });
        res.json({
            success: true,
            data: {
                weekStart,
                weekEnd,
                days: savedWeek,
            },
        });
    }
    catch (error) {
        console.error('Generate schedule error:', error);
        if (error.message?.includes('No AI provider')) {
            res.status(500).json({ success: false, error: 'No AI provider is configured. Please set at least one API key (Gemini, Groq, OpenRouter, or OpenAI) in the server .env file.' });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'Failed to generate schedule. Please try again.',
        });
    }
});
// POST /api/schedule/regenerate-partial - Regenerate part of a schedule
router.post('/regenerate-partial', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { scheduleId, timeRange } = req.body;
        if (!scheduleId || !timeRange?.start || !timeRange?.end) {
            res.status(400).json({
                success: false,
                error: 'scheduleId and timeRange (start, end) are required',
            });
            return;
        }
        const existing = await prisma.schedule.findFirst({
            where: { id: scheduleId, profile: { authId: req.userId } },
            include: { profile: true },
        });
        if (!existing) {
            res.status(404).json({ success: false, error: 'Schedule not found' });
            return;
        }
        const profile = existing.profile;
        const request = {
            profile: {
                wakeUpTime: profile.wakeUpTime,
                bedTime: profile.bedTime,
                sleepHours: profile.sleepHours,
                peakEnergyStart: profile.peakEnergyStart,
                peakEnergyEnd: profile.peakEnergyEnd,
                lowEnergyStart: profile.lowEnergyStart ?? undefined,
                lowEnergyEnd: profile.lowEnergyEnd ?? undefined,
                lifestyle: profile.lifestyle,
                workType: profile.workType ?? undefined,
                workStart: profile.workStart ?? undefined,
                workEnd: profile.workEnd ?? undefined,
                workDays: profile.workDays,
                goals: profile.goals,
                interests: profile.interests,
                exercisePreference: profile.exercisePreference ?? undefined,
                mealTimes: profile.mealTimes ?? undefined,
                fixedCommitments: profile.fixedCommitments ?? undefined,
            },
            dayOfWeek: existing.dayOfWeek,
        };
        const currentSchedule = {
            schedule: existing.blocks,
            suggestions: existing.suggestions || [],
            tips: existing.metadata?.tips || [],
        };
        const regenerated = await (0, openai_service_1.regeneratePartial)(request, timeRange, currentSchedule);
        // Update in database
        await prisma.schedule.update({
            where: { id: scheduleId },
            data: {
                blocks: regenerated.schedule,
                suggestions: regenerated.suggestions,
                metadata: {
                    ...existing.metadata,
                    lastRegenerated: new Date().toISOString(),
                    regeneratedRange: timeRange,
                },
            },
        });
        res.json({ success: true, data: regenerated });
    }
    catch (error) {
        console.error('Regenerate partial error:', error);
        res.status(500).json({ success: false, error: 'Failed to regenerate schedule' });
    }
});
// GET /api/schedule - Get all schedules for user
router.get('/', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const profile = await prisma.profile.findUnique({
            where: { authId: req.userId },
        });
        if (!profile) {
            res.json({ success: true, data: [] });
            return;
        }
        const schedules = await prisma.schedule.findMany({
            where: { profileId: profile.id },
            orderBy: { date: 'desc' },
            take: 30,
        });
        const formatted = schedules.map((s) => ({
            id: s.id,
            date: s.date,
            dayOfWeek: s.dayOfWeek,
            schedule: s.blocks,
            suggestions: s.suggestions,
            tips: s.metadata?.tips || [],
        }));
        res.json({ success: true, data: formatted });
    }
    catch (error) {
        console.error('Get schedules error:', error);
        res.status(500).json({ success: false, error: 'Failed to get schedules' });
    }
});
// GET /api/schedule/:id - Get a specific schedule
router.get('/:id', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        const schedule = await prisma.schedule.findFirst({
            where: {
                id,
                profile: { authId: req.userId },
            },
        });
        if (!schedule) {
            res.status(404).json({ success: false, error: 'Schedule not found' });
            return;
        }
        res.json({
            success: true,
            data: {
                id: schedule.id,
                date: schedule.date,
                dayOfWeek: schedule.dayOfWeek,
                schedule: schedule.blocks,
                suggestions: schedule.suggestions,
                tips: schedule.metadata?.tips || [],
            },
        });
    }
    catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({ success: false, error: 'Failed to get schedule' });
    }
});
// DELETE /api/schedule/:id
router.delete('/:id', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        await prisma.schedule.deleteMany({
            where: {
                id,
                profile: { authId: req.userId },
            },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete schedule error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete schedule' });
    }
});
// Helpers
function getDayOfWeek(date) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
}
function formatDate(date) {
    return date.toISOString().split('T')[0];
}
function getWeekDates(baseDate) {
    const date = new Date(baseDate);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay(); // 0 sunday, 1 monday, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const week = [];
    for (let i = 0; i < 7; i++) {
        const current = new Date(monday);
        current.setDate(monday.getDate() + i);
        week.push({
            date: formatDate(current),
            dayOfWeek: getDayOfWeek(current),
        });
    }
    return week;
}
exports.default = router;
//# sourceMappingURL=schedule.routes.js.map