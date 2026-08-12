import { expertProfileSchema } from '@yersps/contracts';
import { Router } from 'express';
import { prisma } from '../../database/prisma.js';
import {
  authenticate,
  requireActiveAccount,
  type AuthenticatedRequest,
} from '../../middlewares/authenticate.js';
import { AuthError } from '../auth/auth.errors.js';
import { notificationService } from '../../services/notification.service.js';

const router = Router();

const expertIdFor = (request: AuthenticatedRequest) => {
  if (!request.auth) throw new AuthError('AUTH_REQUIRED', 'Log in to continue.', 401);
  if (request.auth.role !== 'EXPERT')
    throw new AuthError('FORBIDDEN', 'This area is for expert accounts.', 403);
  return request.auth.userId;
};

router.use(authenticate, requireActiveAccount);

router.get('/profile', async (request: AuthenticatedRequest, response, next) => {
  try {
    const profile = await prisma.expertProfile.findUnique({
      where: { userId: expertIdFor(request) },
    });
    response.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = expertIdFor(request);
    const parsed = expertProfileSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the submitted information.',
        400,
      );
    const existing = await prisma.expertProfile.findUnique({ where: { userId } });
    if (existing?.approvalStatus === 'PENDING')
      throw new AuthError(
        'EXPERT_APPLICATION_UNDER_REVIEW',
        'Your Expert application is already under System Administrator review.',
        409,
      );
    const remainsApproved = existing?.approvalStatus === 'APPROVED';
    const data = {
      ...parsed.data,
      workplace: parsed.data.workplace || null,
      position: parsed.data.position || null,
      certifications: parsed.data.certifications || null,
      evidenceUrl: parsed.data.evidenceUrl || null,
      approvalStatus: remainsApproved ? ('APPROVED' as const) : ('PENDING' as const),
      submittedAt: remainsApproved ? existing.submittedAt : new Date(),
      reviewedAt: remainsApproved ? existing.reviewedAt : null,
      reviewedById: remainsApproved ? existing.reviewedById : null,
      reviewNote: remainsApproved ? existing.reviewNote : null,
    };
    const profile = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.expertProfile.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: remainsApproved ? 'EXPERT_PROFILE_UPDATED' : 'EXPERT_APPLICATION_SUBMITTED',
          entityType: 'ExpertProfile',
          entityId: saved.id,
        },
      });
      return saved;
    });
    if (!remainsApproved) {
      const systemAdministrators = await prisma.user.findMany({
        where: { role: 'SYSTEM_ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      await notificationService.createMany(
        systemAdministrators.map((item) => item.id),
        {
          type: 'EXPERT_APPLICATION_SUBMITTED',
          title: 'Expert application awaiting review',
          message: 'A new Expert profile is ready for review.',
          href: '/admin/applications',
        },
      );
    }
    response.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

export const expertRouter = router;
