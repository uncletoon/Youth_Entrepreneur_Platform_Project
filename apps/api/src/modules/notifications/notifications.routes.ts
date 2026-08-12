import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate, type AuthenticatedRequest } from '../../middlewares/authenticate.js';
import { AuthError } from '../auth/auth.errors.js';

const router = Router();
const querySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.use(authenticate);

router.get('/', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = request.auth!.userId;
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success)
      throw new AuthError('VALIDATION_ERROR', 'Check the notification filters.', 400);
    const { cursor, limit } = parsed.data;
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    response.json({
      success: true,
      data: { items, unread, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/read-all', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: request.auth!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    response.json({ success: true, data: { updated: result.count } });
  } catch (error) {
    next(error);
  }
});

router.patch('/:notificationId/read', async (request: AuthenticatedRequest, response, next) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: String(request.params.notificationId), userId: request.auth!.userId },
    });
    if (!notification)
      throw new AuthError('NOTIFICATION_NOT_FOUND', 'Notification not found.', 404);
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    response.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export const notificationsRouter = router;
