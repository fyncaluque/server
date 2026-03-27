"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Validation schema
const profileSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    wakeUpTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    bedTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    sleepHours: zod_1.z.number().min(4).max(12),
    peakEnergyStart: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    peakEnergyEnd: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    lowEnergyStart: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    lowEnergyEnd: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    lifestyle: zod_1.z.enum(['active', 'sedentary', 'balanced']),
    workType: zod_1.z.enum(['remote', 'office', 'hybrid', 'student', 'freelance']).optional(),
    workStart: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    workEnd: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    workDays: zod_1.z.array(zod_1.z.string()),
    goals: zod_1.z.array(zod_1.z.string()),
    interests: zod_1.z.array(zod_1.z.string()),
    exercisePreference: zod_1.z.enum(['morning', 'afternoon', 'evening', 'none']).optional(),
    mealTimes: zod_1.z.object({
        breakfast: zod_1.z.string(),
        lunch: zod_1.z.string(),
        dinner: zod_1.z.string(),
    }).optional(),
    fixedCommitments: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        start: zod_1.z.string(),
        end: zod_1.z.string(),
        days: zod_1.z.array(zod_1.z.string()),
        category: zod_1.z.string(),
    })).optional(),
});
// GET /api/profile - Get current user's profile
router.get('/', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const profile = await prisma.profile.findUnique({
            where: { authId: req.userId },
        });
        if (!profile) {
            res.status(404).json({ success: false, error: 'Profile not found' });
            return;
        }
        res.json({ success: true, data: profile });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to get profile' });
    }
});
// POST /api/profile - Create or update profile
router.post('/', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const validation = profileSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.error.errors,
            });
            return;
        }
        const data = validation.data;
        const profile = await prisma.profile.upsert({
            where: { authId: req.userId },
            update: {
                ...data,
                mealTimes: data.mealTimes ?? undefined,
                fixedCommitments: data.fixedCommitments ?? undefined,
            },
            create: {
                authId: req.userId,
                email: req.userEmail,
                ...data,
                mealTimes: data.mealTimes ?? undefined,
                fixedCommitments: data.fixedCommitments ?? undefined,
            },
        });
        res.json({ success: true, data: profile });
    }
    catch (error) {
        console.error('Save profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to save profile' });
    }
});
// DELETE /api/profile - Delete profile
router.delete('/', auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        await prisma.profile.delete({
            where: { authId: req.userId },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete profile' });
    }
});
exports.default = router;
//# sourceMappingURL=profile.routes.js.map