import type {
  AccountProfileInput,
  AuthPayload,
  AuthUser,
  LoginInput,
  PasswordResetInput,
  RegisterInput,
} from '@yersps/contracts';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import type { UserRole } from '../../generated/prisma/enums.js';
import { AuthError } from './auth.errors.js';
import { authRepository } from './auth.repository.js';

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const normalizeIdentifier = (identifier: string) => {
  const value = identifier.trim().toLowerCase();
  if (value.includes('@')) return { email: value, phone: null };
  const phone = value.replace(/[^+\d]/g, '');
  if (phone.length < 7)
    throw new AuthError('INVALID_IDENTIFIER', 'Enter a valid email or telephone number.', 400);
  return { email: null, phone };
};

const publicUser = (user: {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'DISABLED';
  entrepreneurProfile: { completionPercent: number } | null;
  expertProfile: { approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' } | null;
}): AuthUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  profileCompletion: user.entrepreneurProfile?.completionPercent ?? 0,
  expertApprovalStatus: user.expertProfile?.approvalStatus ?? null,
});

const signAccessToken = (user: { id: string; role: UserRole }) =>
  new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .setIssuer('yersps-api')
    .setAudience('yersps-web')
    .sign(accessKey);

const createRefreshToken = () => randomBytes(48).toString('base64url');
const createActionToken = () => randomBytes(32).toString('base64url');

const refreshExpiry = () => {
  const value = new Date();
  value.setDate(value.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return value;
};

interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

const createSessionRecord = async (
  userId: string,
  refreshToken: string,
  context: SessionContext,
) => {
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiry(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
};

export const authService = {
  async register(input: RegisterInput, context: SessionContext) {
    const { email, phone } = normalizeIdentifier(input.identifier);
    const existing = await authRepository.findByIdentifier(email, phone);
    if (existing)
      throw new AuthError(
        'ACCOUNT_EXISTS',
        'An account already uses this email or telephone number.',
        409,
      );

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          fullName: input.fullName.trim(),
          email,
          phone,
          passwordHash,
          role: input.role,
          status: 'ACTIVE',
          consentAt: new Date(),
          ...(input.role === 'ENTREPRENEUR'
            ? { entrepreneurProfile: { create: {} } }
            : {
                expertProfile: {
                  create: {
                    expertiseField: '',
                    proficiencyLevel: '',
                    yearsOfExperience: 0,
                    employmentStatus: '',
                    highestQualification: '',
                    institution: '',
                    professionalSummary: '',
                  },
                },
              }),
        },
        include: { entrepreneurProfile: true, expertProfile: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: created.id,
          action: 'AUTH_REGISTER',
          entityType: 'User',
          entityId: created.id,
          ipAddress: context.ipAddress,
        },
      });
      return created;
    });

    const refreshToken = createRefreshToken();
    await createSessionRecord(user.id, refreshToken, context);
    return {
      payload: {
        user: publicUser(user),
        accessToken: await signAccessToken(user),
      } satisfies AuthPayload,
      refreshToken,
    };
  },

  async login(input: LoginInput, context: SessionContext) {
    const { email, phone } = normalizeIdentifier(input.identifier);
    const user = await authRepository.findByIdentifier(email, phone);
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new AuthError(
        'INVALID_CREDENTIALS',
        'The email, telephone number, or password is incorrect.',
        401,
      );
    }
    if (user.status === 'DISABLED')
      throw new AuthError('ACCOUNT_DISABLED', 'This account is not active.', 403);

    const refreshToken = createRefreshToken();
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: refreshExpiry(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_LOGIN',
          entityType: 'User',
          entityId: user.id,
          ipAddress: context.ipAddress,
        },
      }),
    ]);

    return {
      payload: {
        user: publicUser(user),
        accessToken: await signAccessToken(user),
      } satisfies AuthPayload,
      refreshToken,
    };
  },

  async refresh(rawToken: string | undefined, context: SessionContext) {
    if (!rawToken)
      throw new AuthError('REFRESH_REQUIRED', 'Your session has expired. Log in again.', 401);
    const stored = await authRepository.findRefreshToken(hashToken(rawToken));
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt <= new Date() ||
      stored.user.status === 'DISABLED'
    ) {
      throw new AuthError('INVALID_REFRESH_TOKEN', 'Your session has expired. Log in again.', 401);
    }

    const nextRefreshToken = createRefreshToken();
    await prisma.$transaction([
      prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
      prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: hashToken(nextRefreshToken),
          expiresAt: refreshExpiry(),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
    ]);

    return {
      payload: {
        user: publicUser(stored.user),
        accessToken: await signAccessToken(stored.user),
      } satisfies AuthPayload,
      refreshToken: nextRefreshToken,
    };
  },

  async logout(rawToken: string | undefined) {
    if (!rawToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async verifyAccessToken(token: string) {
    try {
      const { payload } = await jwtVerify(token, accessKey, {
        issuer: 'yersps-api',
        audience: 'yersps-web',
      });
      if (!payload.sub || typeof payload.role !== 'string') throw new Error('Malformed token');
      return { userId: payload.sub, role: payload.role as UserRole };
    } catch {
      throw new AuthError('INVALID_ACCESS_TOKEN', 'Log in to continue.', 401);
    }
  },

  async getCurrentUser(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user || user.status === 'DISABLED')
      throw new AuthError('ACCOUNT_NOT_FOUND', 'The account is unavailable.', 404);
    return publicUser(user);
  },

  async updateAccountProfile(userId: string, input: AccountProfileInput, context: SessionContext) {
    const user = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: userId },
        data: { fullName: input.fullName },
        include: { entrepreneurProfile: true, expertProfile: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'ACCOUNT_PROFILE_UPDATED',
          entityType: 'User',
          entityId: userId,
          newValues: { fullName: updated.fullName },
          ipAddress: context.ipAddress,
        },
      });
      return updated;
    });
    return publicUser(user);
  },

  async requestPasswordReset(identifier: string, context: SessionContext) {
    const { email, phone } = normalizeIdentifier(identifier);
    const user = await authRepository.findByIdentifier(email, phone);
    if (!user) return null;
    const token = createActionToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_PASSWORD_RESET_REQUESTED',
          entityType: 'User',
          entityId: user.id,
          ipAddress: context.ipAddress,
        },
      }),
    ]);
    return { token, user: { fullName: user.fullName, email: user.email, phone: user.phone } };
  },

  async resetPassword(input: PasswordResetInput, context: SessionContext) {
    const stored = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!stored || stored.usedAt || stored.expiresAt <= new Date())
      throw new AuthError(
        'INVALID_RESET_TOKEN',
        'This password reset link is invalid or expired.',
        400,
      );
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await prisma.$transaction([
      prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: stored.userId,
          action: 'AUTH_PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          entityId: stored.userId,
          ipAddress: context.ipAddress,
        },
      }),
    ]);
  },

  async exportAccount(userId: string) {
    const account = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        consentAt: true,
        createdAt: true,
        updatedAt: true,
        entrepreneurProfile: true,
        expertProfile: true,
        businesses: {
          include: {
            sector: true,
            classifications: true,
            assessmentSessions: { include: { responses: true, result: true } },
          },
        },
        recommendations: true,
        adminFeedbackReceived: { include: { replies: true } },
        notifications: true,
        auditLogs: true,
      },
    });
    if (!account) throw new AuthError('ACCOUNT_NOT_FOUND', 'The account is unavailable.', 404);
    return account;
  },

  async deactivateAccount(userId: string, password: string) {
    const user = await authRepository.findById(userId);
    if (!user || !(await argon2.verify(user.passwordHash, password)))
      throw new AuthError('INVALID_CREDENTIALS', 'The password is incorrect.', 401);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: 'DISABLED' } }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'ACCOUNT_SELF_DEACTIVATED',
          entityType: 'User',
          entityId: userId,
          reason: 'Account deactivated by its owner.',
        },
      }),
    ]);
  },
};
