import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate, type AuthenticatedRequest } from '../../middlewares/authenticate.js';
import { AuthError } from '../auth/auth.errors.js';

const router = Router();
const userUpdateSchema = z.object({
  role: z.enum(['SYSTEM_ADMIN', 'ADMIN', 'ENTREPRENEUR']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'PENDING_VERIFICATION']).optional(),
  reason: z.string().trim().min(5).max(500),
});
const expertReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().min(5).max(1000),
});
const systemIdFor = (request: AuthenticatedRequest) => {
  if (!request.auth) throw new AuthError('AUTH_REQUIRED', 'Log in to continue.', 401);
  if (request.auth.role !== 'SYSTEM_ADMIN')
    throw new AuthError('FORBIDDEN', 'System administrator access is required.', 403);
  return request.auth.userId;
};

router.use(authenticate);

router.get('/users', async (request: AuthenticatedRequest, response, next) => {
  try {
    systemIdFor(request);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        contactVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        expertProfile: { select: { approvalStatus: true } },
      },
    });
    response.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.get('/expert-applications', async (request: AuthenticatedRequest, response, next) => {
  try {
    systemIdFor(request);
    const applications = await prisma.expertProfile.findMany({
      orderBy: [{ approvalStatus: 'asc' }, { submittedAt: 'desc' }],
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
        reviewedBy: { select: { fullName: true } },
      },
    });
    response.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/expert-applications/:profileId',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const reviewerId = systemIdFor(request);
      const parsed = expertReviewSchema.safeParse(request.body);
      if (!parsed.success)
        throw new AuthError(
          'VALIDATION_ERROR',
          parsed.error.issues[0]?.message ?? 'Check the review information.',
          400,
        );
      const profileId = String(request.params.profileId);
      const existing = await prisma.expertProfile.findUnique({ where: { id: profileId } });
      if (!existing)
        throw new AuthError('EXPERT_APPLICATION_NOT_FOUND', 'Expert application not found.', 404);
      const profile = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.expertProfile.update({
          where: { id: profileId },
          data: {
            approvalStatus: parsed.data.status,
            reviewNote: parsed.data.reviewNote,
            reviewedAt: new Date(),
            reviewedById: reviewerId,
          },
          include: { user: { select: { fullName: true, email: true, phone: true } } },
        });
        await transaction.refreshToken.updateMany({
          where: { userId: existing.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await transaction.auditLog.create({
          data: {
            actorId: reviewerId,
            action: `EXPERT_APPLICATION_${parsed.data.status}`,
            entityType: 'ExpertProfile',
            entityId: profileId,
            oldValues: { approvalStatus: existing.approvalStatus },
            newValues: { approvalStatus: parsed.data.status },
            reason: parsed.data.reviewNote,
          },
        });
        return updated;
      });
      response.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  },
);

router.patch('/users/:userId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const actorId = systemIdFor(request);
    const parsed = userUpdateSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the submitted information.',
        400,
      );
    const userId = String(request.params.userId);
    if (userId === actorId && parsed.data.status === 'DISABLED')
      throw new AuthError('SELF_DISABLE_BLOCKED', 'You cannot disable your own account.', 400);
    const oldUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (!oldUser) throw new AuthError('USER_NOT_FOUND', 'User not found.', 404);
    const user = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: userId },
        data: { role: parsed.data.role, status: parsed.data.status },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'SYSTEM_USER_UPDATED',
          entityType: 'User',
          entityId: userId,
          oldValues: oldUser,
          newValues: { role: updated.role, status: updated.status },
          reason: parsed.data.reason,
        },
      });
      if (parsed.data.status === 'DISABLED')
        await transaction.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      return updated;
    });
    response.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-logs', async (request: AuthenticatedRequest, response, next) => {
  try {
    systemIdFor(request);
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { actor: { select: { fullName: true, email: true, role: true } } },
    });
    response.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

export const systemRouter = router;
