import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { prisma } from '../database/prisma.js';
import { AuthError } from '../modules/auth/auth.errors.js';
import { authService } from '../modules/auth/auth.service.js';

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; role: UserRole; status: 'ACTIVE' | 'DISABLED' };
}

export const authenticate = async (
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) => {
  try {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token)
      throw new AuthError('AUTH_REQUIRED', 'Log in to continue.', 401);
    const verified = await authService.verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { role: true, status: true },
    });
    if (!user || user.status === 'DISABLED')
      throw new AuthError('ACCOUNT_DISABLED', 'This account is not active.', 403);
    request.auth = { userId: verified.userId, role: user.role, status: user.status };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireActiveAccount = (
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) => {
  if (request.auth?.status !== 'ACTIVE') {
    next(new AuthError('ACCOUNT_DISABLED', 'This account is not active.', 403));
    return;
  }
  next();
};
