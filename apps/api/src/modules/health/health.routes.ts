import { Router } from 'express';

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
