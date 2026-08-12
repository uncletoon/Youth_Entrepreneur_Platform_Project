import { businessProfileSchema, entrepreneurProfileSchema } from '@yersps/contracts';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import {
  authenticate,
  requireActiveAccount,
  type AuthenticatedRequest,
} from '../../middlewares/authenticate.js';
import { AuthError } from '../auth/auth.errors.js';
import { KeywordBusinessClassifier } from '../classification/classification.service.js';
import { calculateReadiness } from '../scoring/scoring.service.js';
import { notificationService } from '../../services/notification.service.js';

const router = Router();
const classifier = new KeywordBusinessClassifier();
const responseSchema = z.object({
  responses: z
    .array(z.object({ questionId: z.string().uuid(), value: z.number().int().min(1).max(5) }))
    .min(1),
});
const startAssessmentSchema = z.object({ businessId: z.string().uuid().optional() });
const classificationDecisionSchema = z.object({
  status: z.enum(['CONFIRMED', 'DISPUTED']),
  reason: z.string().trim().max(500).optional(),
});
const recommendationStatusSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED']),
});
const replySchema = z.object({ message: z.string().trim().min(2).max(2000) });

const userIdFor = (request: AuthenticatedRequest) => {
  if (!request.auth) throw new AuthError('AUTH_REQUIRED', 'Log in to continue.', 401);
  if (request.auth.role !== 'ENTREPRENEUR')
    throw new AuthError('FORBIDDEN', 'This area is for entrepreneur accounts.', 403);
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

router.use(authenticate, requireActiveAccount);

router.get('/overview', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = userIdFor(request);
    const [profile, business, latestSession, recommendations, feedback] = await Promise.all([
      prisma.entrepreneurProfile.findUnique({ where: { userId } }),
      prisma.business.findFirst({
        where: { userId, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { sector: true, classifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      prisma.assessmentSession.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { result: true },
      }),
      prisma.recommendation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.adminFeedback.findMany({
        where: { entrepreneurId: userId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { admin: { select: { fullName: true } } },
      }),
    ]);
    response.json({
      success: true,
      data: { profile, business, latestSession, recommendations, feedback },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sectors', async (_request, response, next) => {
  try {
    const sectors = await prisma.sector.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    response.json({ success: true, data: sectors });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', async (request: AuthenticatedRequest, response, next) => {
  try {
    const profile = await prisma.entrepreneurProfile.findUnique({
      where: { userId: userIdFor(request) },
    });
    response.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = userIdFor(request);
    const input = parse(entrepreneurProfileSchema, request.body);
    const profile = await prisma.entrepreneurProfile.upsert({
      where: { userId },
      update: { ...input, completionPercent: 100 },
      create: { userId, ...input, completionPercent: 100 },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'PROFILE_COMPLETED',
        entityType: 'EntrepreneurProfile',
        entityId: profile.id,
      },
    });
    response.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

router.get('/business', async (request: AuthenticatedRequest, response, next) => {
  try {
    const business = await prisma.business.findFirst({
      where: { userId: userIdFor(request), archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { sector: true, classifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    response.json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
});

router.get('/businesses', async (request: AuthenticatedRequest, response, next) => {
  try {
    const businesses = await prisma.business.findMany({
      where: { userId: userIdFor(request), archivedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        sector: true,
        classifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        assessmentSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { result: true },
        },
      },
    });
    response.json({ success: true, data: businesses });
  } catch (error) {
    next(error);
  }
});

router.post('/business', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = userIdFor(request);
    const input = parse(businessProfileSchema, request.body);
    const selectedSector = input.selectedSectorId
      ? await prisma.sector.findFirst({ where: { id: input.selectedSectorId, active: true } })
      : null;
    const classification = classifier.classify({
      description: input.description,
      productOrService: input.productOrService,
      selectedSector: selectedSector?.name,
    });
    const suggestedSector =
      (await prisma.sector.findFirst({
        where: { name: classification.primarySector, active: true },
      })) ??
      selectedSector ??
      (await prisma.sector.findFirstOrThrow({ where: { code: 'PBS' } }));
    const business = await prisma.business.create({
      data: {
        userId,
        sectorId: suggestedSector.id,
        name: input.name,
        description: input.description,
        problemSolved: input.problemSolved,
        productOrService: input.productOrService,
        targetCustomers: input.targetCustomers,
        location: input.location,
        stage: input.stage,
        revenueModel: input.revenueModel,
        estimatedStartupCapital: input.estimatedStartupCapital,
        availableCapital: input.availableCapital,
        teamSize: input.teamSize,
        registrationStatus: input.registrationStatus,
        salesChannel: input.salesChannel,
        mainRisks: input.mainRisks,
        supportingDocumentName: input.supportingDocumentName || null,
        supportingDocumentUrl: input.supportingDocumentUrl || null,
        profileCompletion: 100,
        classifications: {
          create: {
            suggestedSectorId: suggestedSector.id,
            confidence: classification.confidence,
            explanation: classification.explanation,
            matchedKeywords: classification.matchedKeywords,
            status: classification.requiresReview ? 'SUGGESTED' : 'CONFIRMED',
            confirmedAt: classification.requiresReview ? null : new Date(),
          },
        },
      },
      include: { sector: true, classifications: true },
    });
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'BUSINESS_CREATED',
        entityType: 'Business',
        entityId: business.id,
      },
    });
    response.status(201).json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
});

router.patch('/business/:businessId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = userIdFor(request);
    const input = parse(businessProfileSchema, request.body);
    const businessId = String(request.params.businessId);
    const existing = await prisma.business.findFirst({
      where: { id: businessId, userId, archivedAt: null },
    });
    if (!existing) throw new AuthError('BUSINESS_NOT_FOUND', 'Innovation not found.', 404);
    const selectedSector = input.selectedSectorId
      ? await prisma.sector.findFirst({ where: { id: input.selectedSectorId, active: true } })
      : null;
    const classification = classifier.classify({
      description: input.description,
      productOrService: input.productOrService,
      selectedSector: selectedSector?.name,
    });
    const suggestedSector =
      (await prisma.sector.findFirst({
        where: { name: classification.primarySector, active: true },
      })) ??
      selectedSector ??
      (await prisma.sector.findFirstOrThrow({ where: { code: 'PBS' } }));
    const business = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.business.update({
        where: { id: businessId },
        data: {
          sectorId: suggestedSector.id,
          name: input.name,
          description: input.description,
          problemSolved: input.problemSolved,
          productOrService: input.productOrService,
          targetCustomers: input.targetCustomers,
          location: input.location,
          stage: input.stage,
          revenueModel: input.revenueModel,
          estimatedStartupCapital: input.estimatedStartupCapital,
          availableCapital: input.availableCapital,
          teamSize: input.teamSize,
          registrationStatus: input.registrationStatus,
          salesChannel: input.salesChannel,
          mainRisks: input.mainRisks,
          supportingDocumentName: input.supportingDocumentName || null,
          supportingDocumentUrl: input.supportingDocumentUrl || null,
          profileCompletion: 100,
          classifications: {
            create: {
              suggestedSectorId: suggestedSector.id,
              confidence: classification.confidence,
              explanation: classification.explanation,
              matchedKeywords: classification.matchedKeywords,
              status: classification.requiresReview ? 'SUGGESTED' : 'CONFIRMED',
              confirmedAt: classification.requiresReview ? null : new Date(),
            },
          },
        },
        include: { sector: true, classifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'BUSINESS_UPDATED',
          entityType: 'Business',
          entityId: businessId,
        },
      });
      return updated;
    });
    response.json({ success: true, data: business });
  } catch (error) {
    next(error);
  }
});

router.delete('/business/:businessId', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = userIdFor(request);
    const business = await prisma.business.findFirst({
      where: { id: String(request.params.businessId), userId, archivedAt: null },
    });
    if (!business) throw new AuthError('BUSINESS_NOT_FOUND', 'Innovation not found.', 404);
    await prisma.$transaction([
      prisma.business.update({ where: { id: business.id }, data: { archivedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'BUSINESS_ARCHIVED',
          entityType: 'Business',
          entityId: business.id,
          reason: 'Archived by the owning entrepreneur.',
        },
      }),
    ]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/business/:businessId/classification',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = userIdFor(request);
      const input = parse(classificationDecisionSchema, request.body);
      const business = await prisma.business.findFirst({
        where: { id: String(request.params.businessId), userId, archivedAt: null },
        include: { classifications: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      const classification = business?.classifications[0];
      if (!business || !classification)
        throw new AuthError('CLASSIFICATION_NOT_FOUND', 'Sector classification not found.', 404);
      const updated = await prisma.businessClassification.update({
        where: { id: classification.id },
        data: {
          status: input.status,
          correctionReason: input.reason || null,
          confirmedAt: input.status === 'CONFIRMED' ? new Date() : null,
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: `BUSINESS_CLASSIFICATION_${input.status}`,
          entityType: 'BusinessClassification',
          entityId: updated.id,
          reason: input.reason,
        },
      });
      response.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
);

router.post('/assessment/start', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = userIdFor(request);
    const input = parse(startAssessmentSchema, request.body ?? {});
    const business = await prisma.business.findFirst({
      where: {
        userId,
        archivedAt: null,
        ...(input.businessId ? { id: input.businessId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!business)
      throw new AuthError('BUSINESS_REQUIRED', 'Add your business before starting.', 409);
    let session = await prisma.assessmentSession.findFirst({
      where: { userId, businessId: business.id, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) {
      // StrictMode and repeated clicks can start concurrent requests. The partial unique index
      // allows only one open session, while skipDuplicates makes both requests return it safely.
      await prisma.assessmentSession.createMany({
        data: [{ userId, businessId: business.id, status: 'IN_PROGRESS' }],
        skipDuplicates: true,
      });
      session = await prisma.assessmentSession.findFirstOrThrow({
        where: { userId, businessId: business.id, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'desc' },
      });
    }
    const questions = await prisma.question.findMany({
      where: {
        active: true,
        OR: [{ scope: 'CORE' }, { sectorId: business.sectorId }, { stage: business.stage }],
      },
      orderBy: { displayOrder: 'asc' },
      include: { domain: true },
    });
    const responses = await prisma.assessmentResponse.findMany({
      where: { sessionId: session.id },
    });
    response.json({ success: true, data: { session, questions, responses } });
  } catch (error) {
    next(error);
  }
});

router.get('/assessments', async (request: AuthenticatedRequest, response, next) => {
  try {
    const sessions = await prisma.assessmentSession.findMany({
      where: { userId: userIdFor(request) },
      orderBy: { createdAt: 'desc' },
      include: { business: { include: { sector: true } }, result: true },
    });
    response.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

router.get('/feedback', async (request: AuthenticatedRequest, response, next) => {
  try {
    const feedback = await prisma.adminFeedback.findMany({
      where: { entrepreneurId: userIdFor(request) },
      orderBy: { createdAt: 'desc' },
      include: {
        admin: { select: { fullName: true, expertProfile: { select: { expertiseField: true } } } },
        business: { select: { id: true, name: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, fullName: true, role: true } } },
        },
      },
    });
    response.json({ success: true, data: feedback });
  } catch (error) {
    next(error);
  }
});

router.get('/recommendations', async (request: AuthenticatedRequest, response, next) => {
  try {
    const recommendations = await prisma.recommendation.findMany({
      where: { userId: userIdFor(request) },
      orderBy: { createdAt: 'desc' },
    });
    response.json({ success: true, data: recommendations });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/recommendations/:recommendationId',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = userIdFor(request);
      const input = parse(recommendationStatusSchema, request.body);
      const recommendation = await prisma.recommendation.findFirst({
        where: { id: String(request.params.recommendationId), userId },
      });
      if (!recommendation)
        throw new AuthError('RECOMMENDATION_NOT_FOUND', 'Recommendation not found.', 404);
      const updated = await prisma.recommendation.update({
        where: { id: recommendation.id },
        data: { status: input.status },
      });
      response.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/feedback/:feedbackId/replies',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = userIdFor(request);
      const input = parse(replySchema, request.body);
      const feedback = await prisma.adminFeedback.findFirst({
        where: { id: String(request.params.feedbackId), entrepreneurId: userId },
      });
      if (!feedback) throw new AuthError('FEEDBACK_NOT_FOUND', 'Feedback thread not found.', 404);
      const reply = await prisma.feedbackReply.create({
        data: { feedbackId: feedback.id, authorId: userId, message: input.message },
        include: { author: { select: { id: true, fullName: true, role: true } } },
      });
      void notificationService.create({
        userId: feedback.adminId,
        type: 'FEEDBACK_REPLY',
        title: 'Entrepreneur replied to feedback',
        message: input.message,
        href: `/admin/entrepreneurs/${userId}`,
      });
      response.status(201).json({ success: true, data: reply });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  '/assessment/:sessionId/responses',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = userIdFor(request);
      const sessionId = String(request.params.sessionId);
      const input = parse(responseSchema, request.body);
      const session = await prisma.assessmentSession.findFirst({
        where: { id: sessionId, userId, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
      });
      if (!session)
        throw new AuthError(
          'ASSESSMENT_NOT_FOUND',
          'Assessment not found or already submitted.',
          404,
        );
      await prisma.$transaction(
        input.responses.map(({ questionId, value }) =>
          prisma.assessmentResponse.upsert({
            where: { sessionId_questionId: { sessionId: session.id, questionId } },
            update: { answer: value, rawScore: value, maxScore: 5 },
            create: {
              sessionId: session.id,
              questionId,
              answer: value,
              rawScore: value,
              maxScore: 5,
            },
          }),
        ),
      );
      response.json({ success: true, data: { saved: input.responses.length } });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/assessment/:sessionId/submit',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = userIdFor(request);
      const sessionId = String(request.params.sessionId);
      const session = await prisma.assessmentSession.findFirst({
        where: { id: sessionId, userId, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
        include: {
          business: { select: { sectorId: true, stage: true } },
          responses: { include: { question: { include: { domain: true } } } },
        },
      });
      if (!session)
        throw new AuthError(
          'ASSESSMENT_NOT_FOUND',
          'Assessment not found or already submitted.',
          404,
        );
      const requiredCount = await prisma.question.count({
        where: {
          active: true,
          required: true,
          OR: [
            { scope: 'CORE' },
            { sectorId: session.business.sectorId },
            { stage: session.business.stage },
          ],
        },
      });
      if (session.responses.length < requiredCount)
        throw new AuthError(
          'ASSESSMENT_INCOMPLETE',
          'Answer every required question before submitting.',
          400,
        );

      const grouped = new Map<string, { name: string; weight: number; scores: number[] }>();
      for (const item of session.responses) {
        const domain = item.question.domain;
        const current = grouped.get(domain.code) ?? {
          name: domain.name,
          weight: domain.weight,
          scores: [],
        };
        current.scores.push(((item.rawScore ?? 0) / (item.maxScore ?? 5)) * 100);
        grouped.set(domain.code, current);
      }
      const domains = [...grouped.entries()].map(([code, value]) => ({
        code,
        score: Math.round(
          value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length,
        ),
        weight: value.weight,
        name: value.name,
      }));
      const calculated = calculateReadiness(domains);
      const result = await prisma.$transaction(async (transaction) => {
        const created = await transaction.assessmentResult.create({
          data: {
            sessionId: session.id,
            overallScore: calculated.score,
            readinessLevel: calculated.level,
            riskLevel: calculated.riskLevel,
            domainScores: domains,
            strengths: calculated.strengths,
            gaps: calculated.gaps,
            positiveFactors: calculated.strengths,
            riskFactors: calculated.gaps,
            disclaimer: calculated.disclaimer,
            rulesVersion: calculated.rulesVersion,
          },
        });
        await transaction.assessmentSession.update({
          where: { id: session.id },
          data: { status: 'SUBMITTED', submittedAt: new Date() },
        });
        await transaction.assessmentSession.deleteMany({
          where: {
            userId,
            businessId: session.businessId,
            id: { not: session.id },
            status: { in: ['DRAFT', 'IN_PROGRESS'] },
          },
        });
        await transaction.recommendation.deleteMany({
          where: { userId, source: 'SYSTEM', status: 'NEW' },
        });
        if (calculated.gaps.length) {
          await transaction.recommendation.createMany({
            data: calculated.gaps.map((domain) => ({
              userId,
              title: `Strengthen ${domain.toLowerCase()} readiness`,
              description: `Your answers show that ${domain.toLowerCase()} needs focused preparation before launch or growth.`,
              category: 'Readiness improvement',
              priority: 'HIGH',
              relatedDomain: domain,
              actionSteps: [
                'Review the weak area',
                'Choose one measurable improvement',
                'Track progress weekly',
              ],
              rulesVersion: calculated.rulesVersion,
            })),
          });
        }
        return created;
      });
      const assignments = await prisma.expertAssignment.findMany({
        where: { entrepreneurId: userId, active: true },
        select: { expertId: true },
      });
      void notificationService.createMany(
        assignments.map((item) => item.expertId),
        {
          type: 'ASSESSMENT_SUBMITTED',
          title: 'Assessment ready for review',
          message: 'An assigned entrepreneur submitted a readiness assessment.',
          href: '/admin/reviews',
        },
      );
      response.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/assessment/:sessionId/result',
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const userId = userIdFor(request);
      const sessionId = String(request.params.sessionId);
      const session = await prisma.assessmentSession.findFirst({
        where: { id: sessionId, userId },
        include: { result: true },
      });
      if (!session?.result)
        throw new AuthError('RESULT_NOT_FOUND', 'No submitted result was found.', 404);
      const recommendations = await prisma.recommendation.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      response.json({ success: true, data: { session, result: session.result, recommendations } });
    } catch (error) {
      next(error);
    }
  },
);

export const entrepreneurRouter = router;
