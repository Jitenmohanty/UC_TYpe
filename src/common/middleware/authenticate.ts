import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/AppError';
import { UserRole } from '../constants/roles';
import { Types } from 'mongoose';

interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
  type: 'access' | 'refresh';
}

/**
 * Verifies JWT access token and injects user into req.user
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    if (payload.type !== 'access') {
      return next(new UnauthorizedError('Invalid token type'));
    }

    req.user = {
      userId: new Types.ObjectId(payload.userId),
      role: payload.role,
      email: payload.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError('Invalid token'));
    }
    next(error);
  }
}

/**
 * Optional auth — attaches user if token present but doesn't block if missing
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    if (payload.type === 'access') {
      req.user = {
        userId: new Types.ObjectId(payload.userId),
        role: payload.role,
        email: payload.email,
      };
    }
  } catch {
    // Ignore — optional auth
  }
  next();
}
