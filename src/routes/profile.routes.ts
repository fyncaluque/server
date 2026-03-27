import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

// Validation schema
const profileSchema = z.object({
  name: z.string().optional(),
  wakeUpTime: z.string().regex(/^\d{2}:\d{2}$/),
  bedTime: z.string().regex(/^\d{2}:\d{2}$/),
  sleepHours: z.number().min(4).max(12),
  peakEnergyStart: z.string().regex(/^\d{2}:\d{2}$/),
  peakEnergyEnd: z.string().regex(/^\d{2}:\d{2}$/),
  lowEnergyStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lowEnergyEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lifestyle: z.enum(['active', 'sedentary', 'balanced']),
  workType: z.enum(['remote', 'office', 'hybrid', 'student', 'freelance']).optional(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workDays: z.array(z.string()),
  goals: z.array(z.string()),
  interests: z.array(z.string()),
  exercisePreference: z.enum(['morning', 'afternoon', 'evening', 'none']).optional(),
  mealTimes: z.object({
    breakfast: z.string(),
    lunch: z.string(),
    dinner: z.string(),
  }).optional(),
  fixedCommitments: z.array(z.object({
    name: z.string(),
    start: z.string(),
    end: z.string(),
    days: z.array(z.string()),
    category: z.string(),
  })).optional(),
});

// GET /api/profile - Get current user's profile
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { authId: req.userId! },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Profile not found' });
      return;
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

// POST /api/profile - Create or update profile
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
      where: { authId: req.userId! },
      update: {
        ...data,
        mealTimes: data.mealTimes ?? undefined,
        fixedCommitments: data.fixedCommitments ?? undefined,
      },
      create: {
        authId: req.userId!,
        email: req.userEmail!,
        ...data,
        mealTimes: data.mealTimes ?? undefined,
        fixedCommitments: data.fixedCommitments ?? undefined,
      },
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to save profile' });
  }
});

// DELETE /api/profile - Delete profile
router.delete('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.profile.delete({
      where: { authId: req.userId! },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete profile' });
  }
});

export default router;
