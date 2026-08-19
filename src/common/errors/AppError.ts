export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

export class BookingStateError extends AppError {
  constructor(from: string, to: string) {
    super(
      `Invalid booking state transition from ${from} to ${to}`,
      422,
      'INVALID_BOOKING_TRANSITION',
    );
  }
}

export class AssignmentStateError extends AppError {
  constructor(from: string, to: string) {
    super(
      `Invalid assignment state transition from ${from} to ${to}`,
      422,
      'INVALID_ASSIGNMENT_TRANSITION',
    );
  }
}

export class AllocationError extends AppError {
  constructor(message: string, code = 'ALLOCATION_ERROR') {
    super(message, 422, code);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class IdempotencyError extends AppError {
  constructor() {
    super('Duplicate request detected', 409, 'DUPLICATE_REQUEST');
  }
}
