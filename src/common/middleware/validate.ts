import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodEffects } from 'zod';
import { sendError } from '../utils/response';

type ValidatedSchema = AnyZodObject | ZodEffects<AnyZodObject>;

interface ValidateSchemas {
  body?: ValidatedSchema;
  query?: ValidatedSchema;
  params?: ValidatedSchema;
}

/**
 * Zod validation middleware factory
 * Validates request body, query, and/or params against Zod schemas
 */
export const validate =
  (schemas: ValidateSchemas) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body) as unknown;
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as Record<string, string>;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as Record<string, string>;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
