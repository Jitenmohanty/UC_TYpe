import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import { UserRole } from '../constants/roles';

/**
 * RBAC middleware — requires one of the specified roles
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `This endpoint requires role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
        ),
      );
    }
    next();
  };
}

/**
 * Ensures the requesting barber is the owner of the target resource
 * Usage: attach after requireRole('BARBER')
 */
export function requireSelf(userIdParam = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    const paramId = req.params[userIdParam];
    if (req.user.role === UserRole.ADMIN) {
      return next(); // Admins bypass ownership check
    }
    if (paramId && req.user.userId.toString() !== paramId) {
      return next(new ForbiddenError('You can only access your own resources'));
    }
    next();
  };
}
