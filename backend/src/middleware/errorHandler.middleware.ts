import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    message: 'An internal server error occurred.',
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found.`,
  });
}
