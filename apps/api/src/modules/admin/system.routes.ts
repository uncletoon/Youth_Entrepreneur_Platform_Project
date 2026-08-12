import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import {
  authenticate,
  requireActiveAccount,
  type AuthenticatedRequest,
} from '../../middlewares/authenticate.js';
import { AuthError } from '../auth/auth.errors.js';
import { notificationService } from '../../services/notification.service.js';

const router = Router();
const userUpdateSchema = z.object({
  role: z.enum(['SYSTEM_ADMIN', 'EXPERT', 'ENTREPRENEUR']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  reason: z.string().trim().min(5).max(500),
});
const assignmentSchema = z.object({
  expertId: z.string().uuid(),
  entrepreneurId: z.string().uuid(),
});
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const expertReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z
    .string()
    .trim()
    .min(5, 'Enter a decision note of at least 5 characters.')
    .max(1000, 'Keep the decision note within 1,000 characters.'),
});
const systemIdFor = (request: AuthenticatedRequest) => {
  if (!request.auth) throw new AuthError('AUTH_REQUIRED', 'Log in to continue.', 401);
  if (request.auth.role !== 'SYSTEM_ADMIN')
    throw new AuthError('FORBIDDEN', 'System administrator access is required.', 403);
  return request.auth.userId;
};

router.use(authenticate, requireActiveAccount);

router.get('/users', async (request: AuthenticatedRequest, response, next) => {
  try {
    systemIdFor(request);
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) throw new AuthError('VALIDATION_ERROR', 'Check the page filters.', 400);
    const { page, limit } = parsed.data;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          expertProfile: { select: { approvalStatus: true } },
        },
      }),
      prisma.user.count(),
    ]);
    response.json({
      success: true,
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/expert-applications', async (request: AuthenticatedRequest, response, next) => {
  try {
    systemIdFor(request);
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) throw new AuthError('VALIDATION_ERROR', 'Check the page filters.', 400);
    const { page, limit } = parsed.data;
    const where = { approvalStatus: { not: 'DRAFT' as const } };
    const [applications, total] = await Promise.all([
      prisma.expertProfile.findMany({
        where,
        orderBy: [{ approvalStatus: 'asc' }, { submittedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } },
          reviewedBy: { select: { fullName: true } },
        },
      }),
      prisma.expertProfile.count({ where }),
    ]);
    response.json({
      success: true,
      data: applications,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
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
      if (existing.approvalStatus !== 'PENDING')
        throw new AuthError(
          'EXPERT_APPLICATION_NOT_PENDING',
          'Only an Expert application that is under review can be approved or rejected.',
          409,
        );
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
      await notificationService.create({
        userId: existing.userId,
        type: `EXPERT_APPLICATION_${parsed.data.status}`,
        title:
          parsed.data.status === 'APPROVED'
            ? 'Expert application approved'
            : 'Expert application reviewed',
        message:
          parsed.data.status === 'APPROVED'
            ? 'Your Expert workspace is ready.'
            : `Your Expert application was not approved. ${parsed.data.reviewNote}`,
        href: parsed.data.status === 'APPROVED' ? '/admin' : '/expert/profile',
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
      if (parsed.data.status === 'DISABLED' || parsed.data.role)
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

router.get('/expert-assignments', async (request: AuthenticatedRequest, response, next) => {
  try {
    systemIdFor(request);
    const [assignments, experts, entrepreneurs] = await Promise.all([
      prisma.expertAssignment.findMany({
        where: { active: true },
        orderBy: { createdAt: 'desc' },
        include: {
          expert: {
            select: {
              id: true,
              fullName: true,
              email: true,
              expertProfile: { select: { expertiseField: true, approvalStatus: true } },
            },
          },
          entrepreneur: { select: { id: true, fullName: true, email: true, phone: true } },
          assignedBy: { select: { fullName: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: 'EXPERT', status: 'ACTIVE', expertProfile: { approvalStatus: 'APPROVED' } },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, email: true },
      }),
      prisma.user.findMany({
        where: { role: 'ENTREPRENEUR', status: 'ACTIVE' },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true, email: true, phone: true },
      }),
    ]);
    response.json({ success: true, data: { assignments, experts, entrepreneurs } });
  } catch (error) {
    next(error);
  }
});

router.post('/expert-assignments', async (request: AuthenticatedRequest, response, next) => {
  try {
    const assignedById = systemIdFor(request);
    const parsed = assignmentSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError('VALIDATION_ERROR', 'Choose an Expert and an entrepreneur.', 400);
    const [expert, entrepreneur] = await Promise.all([
      prisma.user.findFirst({
        where: {
          id: parsed.data.expertId,
          role: 'EXPERT',
          status: 'ACTIVE',
          expertProfile: { approvalStatus: 'APPROVED' },
        },
      }),
      prisma.user.findFirst({
        where: { id: parsed.data.entrepreneurId, role: 'ENTREPRENEUR', status: 'ACTIVE' },
      }),
    ]);
    if (!expert) throw new AuthError('EXPERT_NOT_AVAILABLE', 'Choose an approved Expert.', 400);
    if (!entrepreneur)
      throw new AuthError('ENTREPRENEUR_NOT_AVAILABLE', 'Choose an active entrepreneur.', 400);
    const assignment = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.expertAssignment.upsert({
        where: {
          expertId_entrepreneurId: {
            expertId: expert.id,
            entrepreneurId: entrepreneur.id,
          },
        },
        update: { active: true, assignedById },
        create: { expertId: expert.id, entrepreneurId: entrepreneur.id, assignedById },
      });
      await transaction.auditLog.create({
        data: {
          actorId: assignedById,
          action: 'EXPERT_ASSIGNMENT_CREATED',
          entityType: 'ExpertAssignment',
          entityId: saved.id,
          newValues: parsed.data,
        },
      });
      return saved;
    });
    void notificationService.create({
      userId: expert.id,
      type: 'ENTREPRENEUR_ASSIGNED',
      title: 'Entrepreneur assigned',
      message: `${entrepreneur.fullName} is now available in your Expert workspace.`,
      href: `/admin/entrepreneurs/${entrepreneur.id}`,
    });
    response.status(201).json({ success: true, data: assignment });
  } catch (error) {
    next(error);
  }
});

router.delete(
  '/expert-assignments/:assignmentId',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const actorId = systemIdFor(request);
      const assignment = await prisma.expertAssignment.findUnique({
        where: { id: String(request.params.assignmentId) },
      });
      if (!assignment) throw new AuthError('ASSIGNMENT_NOT_FOUND', 'Assignment not found.', 404);
      await prisma.$transaction([
        prisma.expertAssignment.update({ where: { id: assignment.id }, data: { active: false } }),
        prisma.auditLog.create({
          data: {
            actorId,
            action: 'EXPERT_ASSIGNMENT_REMOVED',
            entityType: 'ExpertAssignment',
            entityId: assignment.id,
          },
        }),
      ]);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

router.get('/audit-logs', async (request: AuthenticatedRequest, response, next) => {
  try {
    systemIdFor(request);
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) throw new AuthError('VALIDATION_ERROR', 'Check the page filters.', 400);
    const { page, limit } = parsed.data;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { fullName: true, email: true, role: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    response.json({
      success: true,
      data: logs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

export const systemRouter = router;
