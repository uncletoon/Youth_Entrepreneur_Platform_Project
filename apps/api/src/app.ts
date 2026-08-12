import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { AuthError } from './modules/auth/auth.errors.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { systemRouter } from './modules/admin/system.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { entrepreneurRouter } from './modules/entrepreneur/entrepreneur.routes.js';
import { expertRouter } from './modules/expert/expert.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';

export const createApp = () => {
  const app = express();
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    pinoHttp({
      autoLogging: isProduction,
      level: env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'error',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    }),
  );
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/system', systemRouter);
  app.use('/api/v1/entrepreneur', entrepreneurRouter);
  app.use('/api/v1/expert', expertRouter);
  app.use('/api/v1/notifications', notificationsRouter);

  if (isProduction) {
    const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
    const webDirectory = path.resolve(apiDirectory, '../../web/dist');
    app.use(express.static(webDirectory));
    app.get('/{*path}', (request, response, next) => {
      if (request.path.startsWith('/api/')) {
        next();
        return;
      }
      response.sendFile(path.join(webDirectory, 'index.html'));
    });
  }

  app.use((_request, response) => {
    response.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    });
  });

  app.use(
    (
      error: unknown,
      request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;
      if (error instanceof AuthError) {
        response.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message, requestId: request.id },
        });
        return;
      }

      request.log.error({ err: error }, 'Unhandled request error');
      response.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
          requestId: request.id,
        },
      });
    },
  );

  return app;
};
