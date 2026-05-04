// Wraps async route handlers so rejected promises are forwarded to Express error middleware.
// Usage: router.get('/path', asyncHandler(async (req, res) => { ... }));
// Can be incrementally adopted across routes.

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
