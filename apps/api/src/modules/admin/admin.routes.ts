import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AssessmentStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  authenticate,
  requireActiveAccount,
  type AuthenticatedRequest,
} from '../../middlewares/authenticate.js';
import { AuthError } from '../auth/auth.errors.js';
import { notificationService } from '../../services/notification.service.js';

const router = Router();
const feedbackSchema = z.object({
  message: z.string().trim().min(5).max(2000),
  businessId: z.string().uuid(),
});
const recommendationSchema = z.object({
  businessId: z.string().uuid(),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2).max(100),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  actionSteps: z.array(z.string().trim().min(3).max(300)).min(1).max(10),
});
const reviewSchema = z.object({ status: z.enum(['UNDER_REVIEW', 'REVIEWED', 'ARCHIVED']) });
const questionSchema = z.object({
  code: z.string().trim().min(3).max(80).optional(),
  prompt: z.string().trim().min(10).max(1000),
  helpText: z.string().trim().max(1000).optional(),
  type: z.literal('LIKERT'),
  scope: z.enum(['CORE', 'SECTOR', 'STAGE']),
  domainId: z.string().uuid(),
  sectorId: z.string().uuid().nullable().optional(),
  sectorIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  stage: z.enum(['IDEA', 'PREPARATION', 'STARTUP', 'OPERATING', 'GROWTH']).nullable().optional(),
  required: z.boolean().default(true),
  weight: z.number().positive().max(100).default(1),
  displayOrder: z.number().int().min(1).optional(),
  active: z.boolean().default(true),
});
const expertQuestionSetSchema = z.object({
  sectorIds: z.array(z.string().uuid()).min(1).max(50),
  questions: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        prompt: z.string().trim().min(10).max(1000),
        helpText: z.string().trim().max(1000).optional(),
      }),
    )
    .min(5)
    .max(10),
});
const sectorSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(10),
  keywords: z.array(z.string().trim().min(2)).min(1),
  active: z.boolean(),
});
const domainSchema = z.object({
  code: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(2).max(150).optional(),
  weight: z.number().positive().max(100).optional(),
  description: z.string().trim().min(5),
  displayOrder: z.number().int().min(1).optional(),
  active: z.boolean().optional(),
});
const domainCreateSchema = domainSchema.extend({
  code: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(2).max(150),
  displayOrder: z.number().int().min(1).optional(),
  active: z.boolean().default(true),
});
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const adminIdFor = (request: AuthenticatedRequest) => {
  if (!request.auth) throw new AuthError('AUTH_REQUIRED', 'Log in to continue.', 401);
  if (!['EXPERT', 'SYSTEM_ADMIN'].includes(request.auth.role))
    throw new AuthError('FORBIDDEN', 'Expert access is required.', 403);
  return request.auth.userId;
};

const systemIdFor = (request: AuthenticatedRequest) => {
  const userId = adminIdFor(request);
  if (request.auth?.role !== 'SYSTEM_ADMIN')
    throw new AuthError(
      'SYSTEM_ADMIN_REQUIRED',
      'System Administrator access is required for this operation.',
      403,
    );
  return userId;
};

const assignedEntrepreneurWhere = (request: AuthenticatedRequest) =>
  request.auth?.role === 'SYSTEM_ADMIN'
    ? {}
    : {
        entrepreneurAssignments: {
          some: { expertId: request.auth!.userId, active: true },
        },
      };

const assertEntrepreneurAccess = async (request: AuthenticatedRequest, entrepreneurId: string) => {
  if (request.auth?.role === 'SYSTEM_ADMIN') return;
  const assignment = await prisma.expertAssignment.findFirst({
    where: { expertId: request.auth!.userId, entrepreneurId, active: true },
    select: { id: true },
  });
  if (!assignment)
    throw new AuthError(
      'EXPERT_ASSIGNMENT_REQUIRED',
      'This entrepreneur is not assigned to your Expert workspace.',
      403,
    );
};

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AuthError(
      'VALIDATION_ERROR',
      result.error.issues[0]?.message ?? 'Check the submitted information.',
      400,
    );
  return result.data;
};

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const protectDomainMinimum = async (questionId: string) => {
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new AuthError('QUESTION_NOT_FOUND', 'Question not found.', 404);
  if (!question.active || question.source !== 'SYSTEM_MANDATORY') return question;
  const activeCoreQuestions = await prisma.question.count({
    where: { domainId: question.domainId, source: 'SYSTEM_MANDATORY', active: true },
  });
  if (activeCoreQuestions <= 10)
    throw new AuthError(
      'DOMAIN_MINIMUM_REQUIRED',
      'Every mandatory class must keep its ten active core questions.',
      409,
    );
  return question;
};

const questionForManagement = async (request: AuthenticatedRequest, questionId: string) => {
  const userId = adminIdFor(request);
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { _count: { select: { responses: true } } },
  });
  if (!question) throw new AuthError('QUESTION_NOT_FOUND', 'Question not found.', 404);
  if (
    request.auth?.role !== 'SYSTEM_ADMIN' &&
    (question.source !== 'EXPERT_SUPPLEMENTAL' || question.createdById !== userId)
  )
    throw new AuthError(
      'QUESTION_OWNERSHIP_REQUIRED',
      'Experts can manage only the supplemental questions they created.',
      403,
    );
  return { question, userId };
};

const generatedQuestionCode = () =>
  `EXPERT_${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

const generatedDomainCode = (userId: string) =>
  `EXPERT_${userId.replaceAll('-', '').slice(0, 8).toUpperCase()}_${randomUUID()
    .replaceAll('-', '')
    .slice(0, 8)
    .toUpperCase()}`;

const syncExpertDomainAvailability = async (
  transaction: Prisma.TransactionClient,
  domainId: string,
) => {
  const activeQuestionCount = await transaction.question.count({
    where: { domainId, source: 'EXPERT_SUPPLEMENTAL', active: true },
  });
  await transaction.assessmentDomain.update({
    where: { id: domainId },
    data: { active: activeQuestionCount >= 5 && activeQuestionCount <= 10 },
  });
  return activeQuestionCount;
};

const expertDomainFor = async (domainId: string, userId: string) => {
  const domain = await prisma.assessmentDomain.findUnique({ where: { id: domainId } });
  if (!domain || domain.source !== 'EXPERT_SUPPLEMENTAL' || domain.createdById !== userId)
    throw new AuthError(
      'EXPERT_DOMAIN_REQUIRED',
      'Choose one of your own Expert supplemental domains.',
      400,
    );
  return domain;
};

router.use(authenticate, requireActiveAccount);
router.use(async (request: AuthenticatedRequest, _response, next) => {
  try {
    const userId = adminIdFor(request);
    if (request.auth?.role !== 'SYSTEM_ADMIN') {
      const profile = await prisma.expertProfile.findUnique({
        where: { userId },
        select: { approvalStatus: true },
      });
      if (profile?.approvalStatus !== 'APPROVED')
        throw new AuthError(
          'EXPERT_APPROVAL_REQUIRED',
          'Your expert application must be approved before you can access entrepreneur data.',
          403,
        );
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/overview', async (request: AuthenticatedRequest, response, next) => {
  try {
    adminIdFor(request);
    const userWhere = { role: 'ENTREPRENEUR' as const, ...assignedEntrepreneurWhere(request) };
    const [entrepreneurs, businesses, submitted, reviewed, average] = await Promise.all([
      prisma.user.count({ where: { ...userWhere, status: 'ACTIVE' } }),
      prisma.business.count({ where: { user: userWhere, archivedAt: null } }),
      prisma.assessmentSession.count({
        where: { user: userWhere, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      prisma.assessmentSession.count({ where: { user: userWhere, status: 'REVIEWED' } }),
      prisma.assessmentResult.aggregate({
        where: { session: { user: userWhere } },
        _avg: { overallScore: true },
      }),
    ]);
    response.json({
      success: true,
      data: {
        entrepreneurs,
        businesses,
        submitted,
        reviewed,
        averageScore: Math.round(average._avg.overallScore ?? 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/entrepreneurs', async (request: AuthenticatedRequest, response, next) => {
  try {
    adminIdFor(request);
    const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
    const { page, limit } = parse(paginationSchema, request.query);
    const where: Prisma.UserWhereInput = {
      role: 'ENTREPRENEUR',
      ...assignedEntrepreneurWhere(request),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          entrepreneurProfile: true,
          businesses: {
            where: { archivedAt: null },
            orderBy: { createdAt: 'desc' },
            include: { sector: true },
          },
          assessmentSessions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { result: true },
          },
        },
      }),
      prisma.user.count({ where }),
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

router.get('/entrepreneurs/:userId', async (request: AuthenticatedRequest, response, next) => {
  try {
    adminIdFor(request);
    const user = await prisma.user.findFirst({
      where: {
        id: String(request.params.userId),
        role: 'ENTREPRENEUR',
        ...assignedEntrepreneurWhere(request),
      },
      include: {
        entrepreneurProfile: true,
        businesses: {
          where: { archivedAt: null },
          include: { sector: true, classifications: true },
        },
        assessmentSessions: {
          orderBy: { createdAt: 'desc' },
          include: { result: true, responses: { include: { question: true } } },
        },
        recommendations: {
          orderBy: { createdAt: 'desc' },
          include: { business: { select: { id: true, name: true } } },
        },
        adminFeedbackReceived: {
          orderBy: { createdAt: 'desc' },
          include: {
            admin: { select: { fullName: true } },
            business: { select: { id: true, name: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: { author: { select: { id: true, fullName: true, role: true } } },
            },
          },
        },
      },
    });
    if (!user) throw new AuthError('ENTREPRENEUR_NOT_FOUND', 'Entrepreneur not found.', 404);
    response.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/entrepreneurs/:userId/feedback',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const adminId = adminIdFor(request);
      const input = parse(feedbackSchema, request.body);
      const entrepreneurId = String(request.params.userId);
      await assertEntrepreneurAccess(request, entrepreneurId);
      const entrepreneur = await prisma.user.findFirst({
        where: { id: entrepreneurId, role: 'ENTREPRENEUR' },
      });
      if (!entrepreneur)
        throw new AuthError('ENTREPRENEUR_NOT_FOUND', 'Entrepreneur not found.', 404);
      const business = await prisma.business.findFirst({
        where: { id: input.businessId, userId: entrepreneurId },
      });
      if (!business)
        throw new AuthError(
          'BUSINESS_NOT_FOUND',
          'Choose an innovation that belongs to this entrepreneur.',
          404,
        );
      const feedback = await prisma.$transaction(async (transaction) => {
        const created = await transaction.adminFeedback.create({
          data: { adminId, entrepreneurId, businessId: business.id, message: input.message },
        });
        await transaction.auditLog.create({
          data: {
            actorId: adminId,
            action: 'ADMIN_FEEDBACK_CREATED',
            entityType: 'AdminFeedback',
            entityId: created.id,
          },
        });
        return created;
      });
      void notificationService.create({
        userId: entrepreneurId,
        type: 'EXPERT_FEEDBACK',
        title: 'New Expert feedback',
        message: 'An Expert added feedback to one of your innovations.',
        href: '/app/feedback',
      });
      response.status(201).json({ success: true, data: feedback });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/entrepreneurs/:userId/recommendations',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const adminId = adminIdFor(request);
      const input = parse(recommendationSchema, request.body);
      const entrepreneurId = String(request.params.userId);
      await assertEntrepreneurAccess(request, entrepreneurId);
      const business = await prisma.business.findFirst({
        where: { id: input.businessId, userId: entrepreneurId },
      });
      if (!business)
        throw new AuthError(
          'BUSINESS_NOT_FOUND',
          'Choose an innovation that belongs to this entrepreneur.',
          404,
        );
      const recommendation = await prisma.$transaction(async (transaction) => {
        const created = await transaction.recommendation.create({
          data: {
            userId: entrepreneurId,
            businessId: business.id,
            title: input.title,
            description: input.description,
            category: input.category,
            priority: input.priority,
            actionSteps: input.actionSteps,
            source: 'ADMIN',
            rulesVersion: 'expert-guidance-v1',
          },
          include: { business: { select: { id: true, name: true } } },
        });
        await transaction.auditLog.create({
          data: {
            actorId: adminId,
            action: 'ADMIN_RECOMMENDATION_CREATED',
            entityType: 'Recommendation',
            entityId: created.id,
            newValues: { entrepreneurId, businessId: business.id, priority: input.priority },
          },
        });
        return created;
      });
      void notificationService.create({
        userId: entrepreneurId,
        type: 'EXPERT_RECOMMENDATION',
        title: 'New Expert recommendation',
        message: recommendation.title,
        href: '/app/recommendations',
      });
      response.status(201).json({ success: true, data: recommendation });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/feedback/:feedbackId/replies',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const expertId = adminIdFor(request);
      const input = parse(z.object({ message: z.string().trim().min(2).max(2000) }), request.body);
      const feedback = await prisma.adminFeedback.findUnique({
        where: { id: String(request.params.feedbackId) },
        select: { id: true, entrepreneurId: true },
      });
      if (!feedback) throw new AuthError('FEEDBACK_NOT_FOUND', 'Feedback thread not found.', 404);
      await assertEntrepreneurAccess(request, feedback.entrepreneurId);
      const reply = await prisma.feedbackReply.create({
        data: { feedbackId: feedback.id, authorId: expertId, message: input.message },
        include: { author: { select: { id: true, fullName: true, role: true } } },
      });
      void notificationService.create({
        userId: feedback.entrepreneurId,
        type: 'FEEDBACK_REPLY',
        title: 'New reply from your Expert',
        message: input.message,
        href: '/app/feedback',
      });
      response.status(201).json({ success: true, data: reply });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/assessments', async (request: AuthenticatedRequest, response, next) => {
  try {
    adminIdFor(request);
    const { page, limit } = parse(paginationSchema, request.query);
    const where: Prisma.AssessmentSessionWhereInput = {
      user: { role: 'ENTREPRENEUR', ...assignedEntrepreneurWhere(request) },
      status: {
        in: [AssessmentStatus.SUBMITTED, AssessmentStatus.UNDER_REVIEW, AssessmentStatus.REVIEWED],
      },
    };
    const [sessions, total] = await Promise.all([
      prisma.assessmentSession.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          business: { include: { sector: true } },
          result: true,
        },
      }),
      prisma.assessmentSession.count({ where }),
    ]);
    response.json({
      success: true,
      data: sessions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/assessments/:sessionId/status',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const adminId = adminIdFor(request);
      const input = parse(reviewSchema, request.body);
      const sessionId = String(request.params.sessionId);
      const existing = await prisma.assessmentSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (!existing) throw new AuthError('ASSESSMENT_NOT_FOUND', 'Assessment not found.', 404);
      await assertEntrepreneurAccess(request, existing.userId);
      const session = await prisma.assessmentSession.update({
        where: { id: sessionId },
        data: { status: input.status },
      });
      await prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ASSESSMENT_STATUS_CHANGED',
          entityType: 'AssessmentSession',
          entityId: sessionId,
          newValues: { status: input.status },
        },
      });
      response.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/questions', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = adminIdFor(request);
    const questions = await prisma.question.findMany({
      where:
        request.auth?.role === 'SYSTEM_ADMIN'
          ? { source: { not: 'LEGACY_ARCHIVED' } }
          : {
              OR: [
                { source: 'SYSTEM_MANDATORY' },
                { source: 'EXPERT_SUPPLEMENTAL', createdById: userId },
              ],
            },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      include: {
        domain: true,
        sector: true,
        sectors: { include: { sector: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    response.json({ success: true, data: questions });
  } catch (error) {
    next(error);
  }
});

router.get('/questions/:questionId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = adminIdFor(request);
    const question = await prisma.question.findUnique({
      where: { id: String(request.params.questionId) },
      include: {
        domain: true,
        sector: true,
        sectors: { include: { sector: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    if (!question) throw new AuthError('QUESTION_NOT_FOUND', 'Question not found.', 404);
    if (
      request.auth?.role !== 'SYSTEM_ADMIN' &&
      question.source === 'EXPERT_SUPPLEMENTAL' &&
      question.createdById !== userId
    )
      throw new AuthError('QUESTION_NOT_FOUND', 'Question not found.', 404);
    response.json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.post('/questions', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
    const input = parse(questionSchema, request.body);
    const isSystem = request.auth?.role === 'SYSTEM_ADMIN';
    if (isSystem && (!input.code || !input.displayOrder))
      throw new AuthError(
        'MANDATORY_METADATA_REQUIRED',
        'Mandatory questions require a stable code and display order.',
        400,
      );
    if (isSystem && input.scope !== 'CORE')
      throw new AuthError(
        'MANDATORY_SCOPE_REQUIRED',
        'System mandatory questions must use the core scope.',
        400,
      );
    if (!isSystem && (input.scope !== 'SECTOR' || !input.sectorIds?.length))
      throw new AuthError(
        'EXPERT_SECTOR_REQUIRED',
        'Choose at least one innovation field for an Expert supplemental question.',
        400,
      );
    const expertProfile = isSystem
      ? null
      : await prisma.expertProfile.findUniqueOrThrow({ where: { userId: adminId } });
    if (!isSystem) {
      await expertDomainFor(input.domainId, adminId);
      const activeQuestionCount = await prisma.question.count({
        where: { domainId: input.domainId, source: 'EXPERT_SUPPLEMENTAL', active: true },
      });
      if (activeQuestionCount >= 10)
        throw new AuthError(
          'EXPERT_DOMAIN_MAXIMUM',
          'This Expert domain already has the maximum of 10 active questions.',
          409,
        );
    }
    const nextOrder = isSystem
      ? input.displayOrder!
      : ((
          await prisma.question.aggregate({
            where: { domainId: input.domainId, source: 'EXPERT_SUPPLEMENTAL' },
            _max: { displayOrder: true },
          })
        )._max.displayOrder ?? 0) + 1;
    const question = await prisma.$transaction(async (transaction) => {
      const created = await transaction.question.create({
        data: {
          code: isSystem ? input.code! : generatedQuestionCode(),
          prompt: input.prompt,
          helpText: input.helpText,
          type: 'LIKERT',
          scope: isSystem ? 'CORE' : 'SECTOR',
          domainId: input.domainId,
          sectorId: null,
          stage: null,
          required: true,
          weight: 1,
          displayOrder: nextOrder,
          active: input.active,
          source: isSystem ? 'SYSTEM_MANDATORY' : 'EXPERT_SUPPLEMENTAL',
          createdById: isSystem ? null : adminId,
          expertiseField: expertProfile?.expertiseField ?? null,
          sectors: isSystem
            ? undefined
            : { create: input.sectorIds!.map((sectorId) => ({ sectorId })) },
          options: [
            { label: 'Not yet', value: 1 },
            { label: 'A little', value: 2 },
            { label: 'Partly', value: 3 },
            { label: 'Mostly', value: 4 },
            { label: 'Confidently', value: 5 },
          ],
          scoringConfig: { min: 1, max: 5 },
        },
        include: { domain: true, sectors: { include: { sector: true } } },
      });
      if (!isSystem) await syncExpertDomainAvailability(transaction, input.domainId);
      return created;
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: isSystem ? 'MANDATORY_QUESTION_CREATED' : 'EXPERT_QUESTION_CREATED',
        entityType: 'Question',
        entityId: question.id,
      },
    });
    response.status(201).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.put(
  '/domains/:domainId/question-set',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const adminId = adminIdFor(request);
      if (request.auth?.role !== 'EXPERT')
        throw new AuthError(
          'EXPERT_REQUIRED',
          'Only an approved Expert can save an Expert supplemental question set.',
          403,
        );
      const domainId = String(request.params.domainId);
      const input = parse(expertQuestionSetSchema, request.body);
      await expertDomainFor(domainId, adminId);
      const suppliedIds = input.questions.flatMap((question) => (question.id ? [question.id] : []));
      if (new Set(suppliedIds).size !== suppliedIds.length)
        throw new AuthError(
          'DUPLICATE_QUESTION',
          'Each existing question can appear only once in a question set.',
          400,
        );
      const expertProfile = await prisma.expertProfile.findUniqueOrThrow({
        where: { userId: adminId },
      });

      const questions = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.question.findMany({
          where: {
            domainId,
            source: 'EXPERT_SUPPLEMENTAL',
            createdById: adminId,
            active: true,
          },
          include: { _count: { select: { responses: true } } },
        });
        const existingById = new Map(existing.map((question) => [question.id, question]));
        if (suppliedIds.some((id) => !existingById.has(id)))
          throw new AuthError(
            'QUESTION_OWNERSHIP_REQUIRED',
            'The question set contains a question that does not belong to this Expert domain.',
            403,
          );

        const retainedIds = new Set(suppliedIds);
        for (const omitted of existing.filter((question) => !retainedIds.has(question.id))) {
          if (omitted._count.responses > 0) {
            await transaction.question.update({
              where: { id: omitted.id },
              data: { active: false },
            });
          } else {
            await transaction.question.delete({ where: { id: omitted.id } });
          }
        }

        const saved = [];
        for (const [index, item] of input.questions.entries()) {
          const sharedData = {
            prompt: item.prompt,
            helpText: item.helpText || null,
            scope: 'SECTOR' as const,
            sectorId: null,
            stage: null,
            required: true,
            weight: 1,
            displayOrder: index + 1,
            active: true,
            expertiseField: expertProfile.expertiseField,
          };
          const savedQuestion = item.id
            ? await transaction.question.update({
                where: { id: item.id },
                data: {
                  ...sharedData,
                  sectors: {
                    deleteMany: {},
                    create: input.sectorIds.map((sectorId) => ({ sectorId })),
                  },
                },
                include: { domain: true, sectors: { include: { sector: true } } },
              })
            : await transaction.question.create({
                data: {
                  ...sharedData,
                  code: generatedQuestionCode(),
                  type: 'LIKERT',
                  domainId,
                  source: 'EXPERT_SUPPLEMENTAL',
                  createdById: adminId,
                  sectors: {
                    create: input.sectorIds.map((sectorId) => ({ sectorId })),
                  },
                  options: [
                    { label: 'Not yet', value: 1 },
                    { label: 'A little', value: 2 },
                    { label: 'Partly', value: 3 },
                    { label: 'Mostly', value: 4 },
                    { label: 'Confidently', value: 5 },
                  ],
                  scoringConfig: { min: 1, max: 5 },
                },
                include: { domain: true, sectors: { include: { sector: true } } },
              });
          saved.push(savedQuestion);
        }

        await syncExpertDomainAvailability(transaction, domainId);
        await transaction.auditLog.create({
          data: {
            actorId: adminId,
            action: 'EXPERT_QUESTION_SET_SAVED',
            entityType: 'AssessmentDomain',
            entityId: domainId,
            newValues: {
              questionCount: saved.length,
              sectorIds: input.sectorIds,
              questionIds: saved.map((question) => question.id),
            },
          },
        });
        return saved;
      });

      response.json({
        success: true,
        data: {
          domainId,
          questionCount: questions.length,
          active: questions.length >= 5,
          questions,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.patch('/questions/:questionId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const questionId = String(request.params.questionId);
    const { question: existing, userId: adminId } = await questionForManagement(
      request,
      questionId,
    );
    const input = parse(questionSchema.partial(), request.body);
    if (input.active === false) await protectDomainMinimum(questionId);
    const isSystem = request.auth?.role === 'SYSTEM_ADMIN';
    if (existing.source === 'SYSTEM_MANDATORY' && input.scope && input.scope !== 'CORE')
      throw new AuthError(
        'MANDATORY_SCOPE_REQUIRED',
        'System mandatory questions must use the core scope.',
        400,
      );
    if (existing.source === 'EXPERT_SUPPLEMENTAL' && input.scope && input.scope !== 'SECTOR')
      throw new AuthError(
        'EXPERT_SECTOR_REQUIRED',
        'Expert supplemental questions must remain sector specific.',
        400,
      );
    if (
      existing.source === 'EXPERT_SUPPLEMENTAL' &&
      input.sectorIds &&
      input.sectorIds.length === 0
    )
      throw new AuthError(
        'EXPERT_SECTOR_REQUIRED',
        'Choose at least one innovation field for an Expert supplemental question.',
        400,
      );
    if (!isSystem && input.domainId) await expertDomainFor(input.domainId, adminId);
    const targetDomainId = input.domainId ?? existing.domainId;
    if (existing.source === 'EXPERT_SUPPLEMENTAL' && input.active === true && !existing.active) {
      const activeQuestionCount = await prisma.question.count({
        where: { domainId: targetDomainId, source: 'EXPERT_SUPPLEMENTAL', active: true },
      });
      if (activeQuestionCount >= 10)
        throw new AuthError(
          'EXPERT_DOMAIN_MAXIMUM',
          'This Expert domain already has the maximum of 10 active questions.',
          409,
        );
    }
    const update = isSystem
      ? {
          ...input,
          sectorIds: undefined,
          ...(existing.source === 'SYSTEM_MANDATORY'
            ? { scope: 'CORE' as const, sectorId: null, stage: null, required: true, weight: 1 }
            : { scope: 'SECTOR' as const, stage: null, required: true }),
        }
      : {
          prompt: input.prompt,
          helpText: input.helpText,
          domainId: input.domainId,
          active: input.active,
          scope: 'SECTOR' as const,
          sectorId: null,
          stage: null,
          required: true,
          weight: 1,
          ...(input.sectorIds
            ? {
                sectors: {
                  deleteMany: {},
                  create: input.sectorIds.map((sectorId) => ({ sectorId })),
                },
              }
            : {}),
        };
    const question = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.question.update({
        where: { id: questionId },
        data: update,
        include: { domain: true, sectors: { include: { sector: true } } },
      });
      if (existing.source === 'EXPERT_SUPPLEMENTAL') {
        await syncExpertDomainAvailability(transaction, existing.domainId);
        if (targetDomainId !== existing.domainId)
          await syncExpertDomainAvailability(transaction, targetDomainId);
      }
      return updated;
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action:
          question.source === 'SYSTEM_MANDATORY'
            ? 'MANDATORY_QUESTION_UPDATED'
            : 'EXPERT_QUESTION_UPDATED',
        entityType: 'Question',
        entityId: question.id,
        newValues: update,
      },
    });
    response.json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.delete('/questions/:questionId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const questionId = String(request.params.questionId);
    const { question, userId: adminId } = await questionForManagement(request, questionId);
    await protectDomainMinimum(questionId);
    const archived = question._count.responses > 0;
    await prisma.$transaction(async (transaction) => {
      if (archived) {
        await transaction.question.update({ where: { id: questionId }, data: { active: false } });
      } else {
        await transaction.question.delete({ where: { id: questionId } });
      }
      if (question.source === 'EXPERT_SUPPLEMENTAL')
        await syncExpertDomainAvailability(transaction, question.domainId);
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: archived
          ? `${question.source}_QUESTION_ARCHIVED`
          : `${question.source}_QUESTION_DELETED`,
        entityType: 'Question',
        entityId: questionId,
        reason: archived
          ? 'Question had historical responses and was archived instead of permanently deleted.'
          : 'Unused question deleted by an administrator.',
      },
    });
    response.json({
      success: true,
      data: {
        deleted: !archived,
        archived,
        message: archived
          ? 'Question archived to protect historical assessment responses.'
          : 'Question deleted.',
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/configuration', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = adminIdFor(request);
    const [sectors, domains] = await Promise.all([
      prisma.sector.findMany({ orderBy: { name: 'asc' } }),
      prisma.assessmentDomain.findMany({
        where:
          request.auth?.role === 'SYSTEM_ADMIN'
            ? { source: { not: 'LEGACY_ARCHIVED' } }
            : {
                OR: [
                  { source: 'SYSTEM_MANDATORY', active: true },
                  { source: 'EXPERT_SUPPLEMENTAL', createdById: userId },
                ],
              },
        orderBy: [{ source: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          createdBy: { select: { id: true, fullName: true } },
          _count: {
            select: {
              questions: {
                where: { active: true },
              },
            },
          },
        },
      }),
    ]);
    response.json({ success: true, data: { sectors, domains } });
  } catch (error) {
    next(error);
  }
});

router.patch('/sectors/:sectorId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = systemIdFor(request);
    const input = parse(sectorSchema.partial(), request.body);
    const sector = await prisma.sector.update({
      where: { id: String(request.params.sectorId) },
      data: input,
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'SECTOR_UPDATED',
        entityType: 'Sector',
        entityId: sector.id,
        newValues: input,
      },
    });
    response.json({ success: true, data: sector });
  } catch (error) {
    next(error);
  }
});

router.patch('/domains/:domainId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
    const input = parse(domainSchema.partial(), request.body);
    const existing = await prisma.assessmentDomain.findUnique({
      where: { id: String(request.params.domainId) },
    });
    if (!existing) throw new AuthError('DOMAIN_NOT_FOUND', 'Readiness domain not found.', 404);
    const isSystem = request.auth?.role === 'SYSTEM_ADMIN';
    if (
      !isSystem &&
      (existing.source !== 'EXPERT_SUPPLEMENTAL' || existing.createdById !== adminId)
    )
      throw new AuthError(
        'DOMAIN_OWNERSHIP_REQUIRED',
        'Experts can manage only the supplemental domains they created.',
        403,
      );
    if (input.active === false) {
      const mandatoryCount = await prisma.question.count({
        where: {
          domainId: String(request.params.domainId),
          source: 'SYSTEM_MANDATORY',
          active: true,
        },
      });
      if (mandatoryCount > 0)
        throw new AuthError(
          'DOMAIN_IN_USE',
          'Archive or move the mandatory questions before deactivating this class.',
          409,
        );
    }
    const expertUpdate = {
      name: input.name,
      description: input.description,
    };
    const domain = await prisma.assessmentDomain.update({
      where: { id: String(request.params.domainId) },
      data: isSystem ? input : expertUpdate,
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'SCORING_DOMAIN_UPDATED',
        entityType: 'AssessmentDomain',
        entityId: domain.id,
        newValues: input,
      },
    });
    response.json({ success: true, data: domain });
  } catch (error) {
    next(error);
  }
});

router.post('/domains', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
    const input = parse(domainCreateSchema, request.body);
    const isSystem = request.auth?.role === 'SYSTEM_ADMIN';
    if (isSystem && (!input.code || !input.displayOrder))
      throw new AuthError(
        'MANDATORY_METADATA_REQUIRED',
        'A mandatory class requires a stable code and display order.',
        400,
      );
    const expertProfile = isSystem
      ? null
      : await prisma.expertProfile.findUniqueOrThrow({ where: { userId: adminId } });
    const nextOrder = isSystem
      ? input.displayOrder!
      : ((
          await prisma.assessmentDomain.aggregate({
            where: { source: 'EXPERT_SUPPLEMENTAL', createdById: adminId },
            _max: { displayOrder: true },
          })
        )._max.displayOrder ?? 1000) + 1;
    const domain = await prisma.assessmentDomain.create({
      data: {
        code: isSystem ? input.code! : generatedDomainCode(adminId),
        name: input.name,
        description: input.description,
        weight: isSystem ? (input.weight ?? 1) : 1,
        displayOrder: nextOrder,
        active: isSystem ? input.active : false,
        source: isSystem ? 'SYSTEM_MANDATORY' : 'EXPERT_SUPPLEMENTAL',
        createdById: isSystem ? null : adminId,
        expertiseField: expertProfile?.expertiseField ?? null,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: isSystem ? 'SCORING_DOMAIN_CREATED' : 'EXPERT_DOMAIN_CREATED',
        entityType: 'AssessmentDomain',
        entityId: domain.id,
        newValues: input,
      },
    });
    response.status(201).json({ success: true, data: domain });
  } catch (error) {
    next(error);
  }
});

router.delete('/domains/:domainId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
    const domainId = String(request.params.domainId);
    const domain = await prisma.assessmentDomain.findUnique({
      where: { id: domainId },
      include: {
        questions: {
          select: { id: true, active: true, source: true, _count: { select: { responses: true } } },
        },
      },
    });
    if (!domain) throw new AuthError('DOMAIN_NOT_FOUND', 'Readiness class not found.', 404);
    if (
      request.auth?.role !== 'SYSTEM_ADMIN' &&
      (domain.source !== 'EXPERT_SUPPLEMENTAL' || domain.createdById !== adminId)
    )
      throw new AuthError(
        'DOMAIN_OWNERSHIP_REQUIRED',
        'Experts can remove only the supplemental domains they created.',
        403,
      );
    if (
      domain.questions.some((question) => question.active && question.source === 'SYSTEM_MANDATORY')
    )
      throw new AuthError(
        'DOMAIN_IN_USE',
        'A class with active mandatory questions cannot be removed.',
        409,
      );
    const hasHistory = domain.questions.some((question) => question._count.responses > 0);
    if (hasHistory || domain.questions.length > 0) {
      await prisma.$transaction([
        prisma.question.updateMany({ where: { domainId }, data: { active: false } }),
        prisma.assessmentDomain.update({ where: { id: domainId }, data: { active: false } }),
      ]);
    } else {
      await prisma.assessmentDomain.delete({ where: { id: domainId } });
    }
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action:
          hasHistory || domain.questions.length > 0
            ? 'SCORING_DOMAIN_ARCHIVED'
            : 'SCORING_DOMAIN_DELETED',
        entityType: 'AssessmentDomain',
        entityId: domainId,
      },
    });
    response.json({
      success: true,
      data: { deleted: !hasHistory && domain.questions.length === 0 },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/assessments.csv', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = systemIdFor(request);
    const results = await prisma.assessmentResult.findMany({
      orderBy: { createdAt: 'desc' },
      include: { session: { include: { user: true, business: { include: { sector: true } } } } },
    });
    const rows = [
      ['Entrepreneur', 'Contact', 'Business', 'Sector', 'Score', 'Readiness', 'Risk', 'Submitted'],
      ...results.map((item) => [
        item.session.user.fullName,
        item.session.user.email ?? item.session.user.phone ?? '',
        item.session.business.name,
        item.session.business.sector?.name ?? '',
        item.overallScore,
        item.readinessLevel,
        item.riskLevel,
        item.createdAt.toISOString(),
      ]),
    ];
    await prisma.auditLog.create({
      data: { actorId: adminId, action: 'REPORT_EXPORTED', entityType: 'AssessmentResult' },
    });
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="yersps-assessments.csv"');
    response.send(rows.map((row) => row.map(csvCell).join(',')).join('\n'));
  } catch (error) {
    next(error);
  }
});

export const adminRouter = router;
