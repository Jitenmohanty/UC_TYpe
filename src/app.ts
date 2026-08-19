import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './common/utils/logger';
import { requestIdMiddleware } from './common/middleware/requestId';
import { errorHandler, notFoundHandler } from './common/errors/errorHandler';
import { generalRateLimiter } from './common/middleware/rateLimiter';

// Route imports
import { authRoutes } from './modules/auth/auth.routes';
import { customerRoutes } from './modules/customers/customer.routes';
import { barberRoutes } from './modules/barbers/barber.routes';
import { barberServiceRoutes } from './modules/barberServices/barberService.routes';
import { serviceRoutes } from './modules/services/service.routes';
import { bookingRoutes } from './modules/bookings/booking.routes';
import { assignmentRoutes } from './modules/assignments/assignment.routes';
import { reviewRoutes } from './modules/reviews/review.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { setupSwagger } from './docs/swagger';

export function createApp(): Application {
  const app = express();

  // ─── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    }),
  );

  // ─── Request Parsing ────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Request ID + Logging ───────────────────────────────────────────────────
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res) => {
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customProps: (req) => ({ requestId: req.id }),
      redact: ['req.headers.authorization'],
    }),
  );

  // ─── General Rate Limiting ──────────────────────────────────────────────────
  app.use(generalRateLimiter);

  // ─── Health Checks ──────────────────────────────────────────────────────────
  app.get(`${env.API_PREFIX}/health`, (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  });

  app.get(`${env.API_PREFIX}/ready`, async (_req, res) => {
    const { getDatabaseStatus } = await import('./config/database');
    const { getRedisStatus } = await import('./config/redis');

    const dbStatus = getDatabaseStatus();
    const redisStatus = getRedisStatus();
    const isReady = dbStatus === 'connected' && redisStatus === 'ready';

    res.status(isReady ? 200 : 503).json({
      success: isReady,
      data: {
        database: dbStatus,
        redis: redisStatus,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // ─── API Routes ─────────────────────────────────────────────────────────────
  const prefix = env.API_PREFIX;
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/customers`, customerRoutes);
  app.use(`${prefix}/barbers`, barberRoutes);
  app.use(`${prefix}/barbers/me/services`, barberServiceRoutes);
  app.use(`${prefix}/services`, serviceRoutes);
  app.use(`${prefix}/bookings`, bookingRoutes);
  app.use(`${prefix}/assignments`, assignmentRoutes);
  app.use(`${prefix}/reviews`, reviewRoutes);
  app.use(`${prefix}/admin`, adminRoutes);

  // ─── API Documentation ──────────────────────────────────────────────────────
  if (env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  // ─── Error Handling ─────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
