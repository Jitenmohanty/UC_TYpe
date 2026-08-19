import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Injects a unique request ID into every request
 * Used in logging and error tracking
 */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.id = (req.headers['x-request-id'] as string) ?? uuidv4();
  next();
}
