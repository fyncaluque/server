import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.middleware';
import { streamChatResponse } from '../services/chat.service';
import { ChatRequest, ChatContext } from '../types';

const router = Router();
const prisma = new PrismaClient();

// POST /api/chat - Chat with AI about schedule
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, context, history, provider } = req.body as ChatRequest;

    if (!message || !context) {
      res.status(400).json({ success: false, error: 'message and context are required' });
      return;
    }

    // Verify the profile belongs to the user
    if (context.profile?.id) {
      const profile = await prisma.profile.findUnique({
        where: { authId: req.userId! },
      });
      if (!profile) {
        res.status(403).json({ success: false, error: 'Profile not found' });
        return;
      }
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      for await (const chunk of streamChatResponse(
        message,
        context as ChatContext,
        history || [],
        provider
      )) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } catch (aiError: any) {
      res.write(
        `data: ${JSON.stringify({
          type: 'token',
          content: 'Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo.',
        })}\n\n`
      );
      res.write(`data: ${JSON.stringify({ type: 'actions', data: [] })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    } else {
      res.end();
    }
  }
});

export default router;
