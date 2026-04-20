import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode ?? 500;
  const code       = err.code ?? 'INTERNAL_ERROR';

  logger.error('Unhandled error', {
    statusCode, code, message: err.message,
    path: req.path, method: req.method,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });

  res.status(statusCode).json({
    error: {
      code,
      message: statusCode === 500 ? 'Internal server error' : err.message,
    },
    ts: new Date().toISOString(),
  });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` },
    ts: new Date().toISOString(),
  });
}
