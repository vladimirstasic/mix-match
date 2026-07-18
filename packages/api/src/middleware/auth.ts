import { getAuth, verifyToken } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (userId) {
    req.userId = userId;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await verifyToken(authHeader.slice(7), { secretKey: config.clerkSecretKey });
      req.userId = payload.sub;
      return next();
    } catch {
      // falls through to 401 below
    }
  }

  res.status(401).json({ error: 'Unauthorized' });
}

export function getUserId(req: Request): string {
  return req.userId!;
}
