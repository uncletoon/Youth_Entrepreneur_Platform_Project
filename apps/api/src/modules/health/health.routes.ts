import { Router } from 'express';
import { prisma } from '../../database/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  response.json({
    success: true,
    data: {
      status: 'ok',
      service: 'yersps-api',
      timestamp: new Date().toISOString(),
    },
  });
});

healthRouter.get('/ready', async (_request, response) => {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({
      success: true,
      data: {
        status: 'ready',
        service: 'yersps-api',
        database: 'reachable',
        responseTimeMs: Math.round(performance.now() - startedAt),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    response.status(503).json({
      success: false,
      error: { code: 'SERVICE_NOT_READY', message: 'The database is not reachable.' },
    });
  }
});
