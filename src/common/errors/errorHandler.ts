import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from './AppError';
import { logger } from '../utils/logger';
import { env } from '../../config/env';
import { sendError } from '../utils/response';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation error
  if (err instanceof ZodError) {
    logger.warn({ msg: 'Validation error', requestId: req.id, errors: err.flatten() });
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', err.flatten().fieldErrors);
    return;
  }

  // Known operational error
  if (err instanceof AppError) {
    logger.warn({
      msg: 'Operational error',
      requestId: req.id,
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
    });
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Mongoose duplicate key error
  if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
    const field = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0];
    sendError(res, 409, 'DUPLICATE_KEY', `${field ?? 'Field'} already exists`);
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    sendError(res, 400, 'MONGOOSE_VALIDATION_ERROR', messages.join(', '));
    return;
  }

  // Mongoose cast error (invalid ObjectId etc.)
  if (err instanceof mongoose.Error.CastError) {
    sendError(res, 400, 'INVALID_ID', `Invalid ${err.path}: ${String(err.value)}`);
    return;
  }

  // Unknown/programming error
  const error = err as Error;
  logger.error({
    msg: 'Unhandled error',
    requestId: req.id,
    error: error.message,
    stack: error.stack,
  });

  // Never expose internals in production
  const message =
    env.NODE_ENV === 'production' ? 'An unexpected error occurred' : (error.message ?? 'Unknown error');

  sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `Cannot ${req.method} ${req.path}`);
}
