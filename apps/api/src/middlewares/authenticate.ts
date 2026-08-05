import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../generated/prisma/enums.js';
import { AuthError } from '../modules/auth/auth.errors.js';
import { authService } from '../modules/auth/auth.service.js';

export interface AuthenticatedRequest extends Request {
  auth?: { userId: string; role: UserRole };
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
    request.auth = await authService.verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
};
