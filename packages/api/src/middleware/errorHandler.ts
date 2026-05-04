import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Internal server error' });
}
