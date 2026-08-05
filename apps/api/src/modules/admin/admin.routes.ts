import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { authenticate, type AuthenticatedRequest } from '../../middlewares/authenticate.js';
import { AuthError } from '../auth/auth.errors.js';

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
  code: z.string().trim().min(3).max(80),
  prompt: z.string().trim().min(10).max(1000),
  helpText: z.string().trim().max(1000).optional(),
  type: z.enum([
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'LIKERT',
    'BOOLEAN',
    'NUMBER',
    'CURRENCY',
    'SHORT_TEXT',
    'LONG_TEXT',
    'SCENARIO',
    'FILE_EVIDENCE',
  ]),
  scope: z.enum(['CORE', 'SECTOR', 'STAGE']),
  domainId: z.string().uuid(),
  sectorId: z.string().uuid().nullable().optional(),
  stage: z.enum(['IDEA', 'PREPARATION', 'STARTUP', 'OPERATING', 'GROWTH']).nullable().optional(),
  required: z.boolean().default(true),
  weight: z.number().positive().max(100).default(1),
  displayOrder: z.number().int().min(1),
  active: z.boolean().default(true),
});
const sectorSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(10),
  keywords: z.array(z.string().trim().min(2)).min(1),
  active: z.boolean(),
});
const domainSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  weight: z.number().positive().max(100),
  description: z.string().trim().min(5),
  displayOrder: z.number().int().min(1).optional(),
});

const adminIdFor = (request: AuthenticatedRequest) => {
  if (!request.auth) throw new AuthError('AUTH_REQUIRED', 'Log in to continue.', 401);
  if (!['ADMIN', 'SYSTEM_ADMIN'].includes(request.auth.role))
    throw new AuthError('FORBIDDEN', 'Administrator access is required.', 403);
  return request.auth.userId;
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
  if (!question.active || question.scope !== 'CORE') return question;
  const activeCoreQuestions = await prisma.question.count({
    where: { domainId: question.domainId, scope: 'CORE', active: true },
  });
  if (activeCoreQuestions <= 5)
    throw new AuthError(
      'DOMAIN_MINIMUM_REQUIRED',
      'Every domain must keep at least five active core questions.',
      409,
    );
  return question;
};

router.use(authenticate);
router.use(async (request: AuthenticatedRequest, _response, next) => {
  try {
    adminIdFor(request);
    if (request.auth?.role === 'ADMIN') {
      const profile = await prisma.expertProfile.findUnique({
        where: { userId: request.auth.userId },
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
    const [entrepreneurs, businesses, submitted, reviewed, average] = await Promise.all([
      prisma.user.count({ where: { role: 'ENTREPRENEUR', status: 'ACTIVE' } }),
      prisma.business.count(),
      prisma.assessmentSession.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      prisma.assessmentSession.count({ where: { status: 'REVIEWED' } }),
      prisma.assessmentResult.aggregate({ _avg: { overallScore: true } }),
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
    const users = await prisma.user.findMany({
      where: {
        role: 'ENTREPRENEUR',
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        entrepreneurProfile: true,
        businesses: { orderBy: { createdAt: 'desc' }, include: { sector: true } },
        assessmentSessions: { orderBy: { createdAt: 'desc' }, take: 1, include: { result: true } },
      },
    });
    response.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.get('/entrepreneurs/:userId', async (request: AuthenticatedRequest, response, next) => {
  try {
    adminIdFor(request);
    const user = await prisma.user.findFirst({
      where: { id: String(request.params.userId), role: 'ENTREPRENEUR' },
      include: {
        entrepreneurProfile: true,
        businesses: { include: { sector: true, classifications: true } },
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
      response.status(201).json({ success: true, data: recommendation });
    } catch (error) {
      next(error);
    }
  },
);

router.get('/assessments', async (request: AuthenticatedRequest, response, next) => {
  try {
    adminIdFor(request);
    const sessions = await prisma.assessmentSession.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'REVIEWED'] } },
      orderBy: { submittedAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        business: { include: { sector: true } },
        result: true,
      },
    });
    response.json({ success: true, data: sessions });
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
    adminIdFor(request);
    const questions = await prisma.question.findMany({
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      include: { domain: true, sector: true },
    });
    response.json({ success: true, data: questions });
  } catch (error) {
    next(error);
  }
});

router.get('/questions/:questionId', async (request: AuthenticatedRequest, response, next) => {
  try {
    adminIdFor(request);
    const question = await prisma.question.findUnique({
      where: { id: String(request.params.questionId) },
      include: { domain: true, sector: true },
    });
    if (!question) throw new AuthError('QUESTION_NOT_FOUND', 'Question not found.', 404);
    response.json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.post('/questions', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
    const input = parse(questionSchema, request.body);
    const question = await prisma.question.create({
      data: {
        ...input,
        options:
          input.type === 'LIKERT'
            ? [
                { label: 'Not yet', value: 1 },
                { label: 'A little', value: 2 },
                { label: 'Partly', value: 3 },
                { label: 'Mostly', value: 4 },
                { label: 'Confidently', value: 5 },
              ]
            : undefined,
        scoringConfig: input.type === 'LIKERT' ? { min: 1, max: 5 } : undefined,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'QUESTION_CREATED',
        entityType: 'Question',
        entityId: question.id,
      },
    });
    response.status(201).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.patch('/questions/:questionId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
    const input = parse(questionSchema.partial(), request.body);
    if (input.active === false) await protectDomainMinimum(String(request.params.questionId));
    const question = await prisma.question.update({
      where: { id: String(request.params.questionId) },
      data: input,
    });
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'QUESTION_UPDATED',
        entityType: 'Question',
        entityId: question.id,
        newValues: input,
      },
    });
    response.json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.delete('/questions/:questionId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
    const questionId = String(request.params.questionId);
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { _count: { select: { responses: true } } },
    });
    if (!question) throw new AuthError('QUESTION_NOT_FOUND', 'Question not found.', 404);
    await protectDomainMinimum(questionId);
    const archived = question._count.responses > 0;
    if (archived) {
      await prisma.question.update({ where: { id: questionId }, data: { active: false } });
    } else {
      await prisma.question.delete({ where: { id: questionId } });
    }
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: archived ? 'QUESTION_ARCHIVED' : 'QUESTION_DELETED',
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
    adminIdFor(request);
    const [sectors, domains] = await Promise.all([
      prisma.sector.findMany({ orderBy: { name: 'asc' } }),
      prisma.assessmentDomain.findMany({
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: { select: { questions: { where: { active: true } } } },
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
    const adminId = adminIdFor(request);
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
    const domain = await prisma.assessmentDomain.update({
      where: { id: String(request.params.domainId) },
      data: input,
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

router.get('/reports/assessments.csv', async (request: AuthenticatedRequest, response, next) => {
  try {
    const adminId = adminIdFor(request);
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
