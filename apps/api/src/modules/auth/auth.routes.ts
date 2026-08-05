import {
  contactVerificationSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
} from '@yersps/contracts';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate, type AuthenticatedRequest } from '../../middlewares/authenticate.js';
import { AuthError } from './auth.errors.js';
import { authService } from './auth.service.js';

const REFRESH_COOKIE = 'yersps_refresh';
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' },
  },
});

const contextFor = (request: AuthenticatedRequest) => ({
  ipAddress: request.ip,
  userAgent: request.get('user-agent'),
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (request, response, next) => {
  try {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the form.',
        400,
      );
    const result = await authService.register(parsed.data, contextFor(request));
    response.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    response.status(201).json({ success: true, data: result.payload });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', authLimiter, async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the form.',
        400,
      );
    const result = await authService.login(parsed.data, contextFor(request));
    response.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    response.json({ success: true, data: result.payload });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (request, response, next) => {
  try {
    const result = await authService.refresh(request.cookies[REFRESH_COOKIE], contextFor(request));
    response.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    response.json({ success: true, data: result.payload });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', async (request, response, next) => {
  try {
    await authService.logout(request.cookies[REFRESH_COOKIE]);
    response.clearCookie(REFRESH_COOKIE, cookieOptions);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticate, async (request: AuthenticatedRequest, response, next) => {
  try {
    const user = await authService.getCurrentUser(request.auth!.userId);
    response.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/password-reset/request', authLimiter, async (request, response, next) => {
  try {
    const parsed = passwordResetRequestSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the form.',
        400,
      );
    const token = await authService.requestPasswordReset(
      parsed.data.identifier,
      contextFor(request),
    );
    response.json({
      success: true,
      data: {
        message: 'If the account exists, password reset instructions are ready.',
        ...(env.NODE_ENV !== 'production' && token ? { developmentToken: token } : {}),
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/password-reset/complete', authLimiter, async (request, response, next) => {
  try {
    const parsed = passwordResetSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the form.',
        400,
      );
    await authService.resetPassword(parsed.data, contextFor(request));
    response.json({ success: true, data: { message: 'Your password has been updated.' } });
  } catch (error) {
    next(error);
  }
});

authRouter.post(
  '/verification/request',
  authenticate,
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const token = await authService.requestContactVerification(request.auth!.userId);
      response.json({
        success: true,
        data: {
          message: token ? 'Verification instructions are ready.' : 'Contact is already verified.',
          ...(env.NODE_ENV !== 'production' && token ? { developmentToken: token } : {}),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post('/verification/complete', authLimiter, async (request, response, next) => {
  try {
    const parsed = contactVerificationSchema.safeParse(request.body);
    if (!parsed.success)
      throw new AuthError(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Check the form.',
        400,
      );
    await authService.verifyContact(parsed.data.token);
    response.json({ success: true, data: { message: 'Contact verified.' } });
  } catch (error) {
    next(error);
  }
});
