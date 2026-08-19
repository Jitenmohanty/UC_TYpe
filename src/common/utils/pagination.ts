import { PaginationQuery, PaginatedResult } from '../types/global';

export function parsePagination(query: Record<string, unknown>): Required<PaginationQuery> {
  const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query['limit'] ?? '20'), 10)));
  const sortBy = String(query['sortBy'] ?? 'createdAt');
  const sortOrder = query['sortOrder'] === 'asc' ? 'asc' : 'desc';
  return { page, limit, sortBy, sortOrder };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function getSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
