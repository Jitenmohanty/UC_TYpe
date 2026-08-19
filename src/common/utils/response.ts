import { Response } from 'express';
import { PaginatedResult } from '../types/global';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    pagination?: Omit<PaginatedResult<unknown>, 'data'>;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: ApiResponse['meta'],
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta,
  };
  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message, 201);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const response: ApiResponse = {
    success: false,
    error: { code, message, details },
  };
  res.status(statusCode).json(response);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}

export function buildPaginatedMeta<T>(
  result: PaginatedResult<T>,
): ApiResponse['meta'] {
  return {
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
  };
}
