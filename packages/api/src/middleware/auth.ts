import { getAuth } from '@clerk/express';
import { verifyToken } from '@clerk/backend';
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
      const token = authHeader.slice(7);
      const payload = await verifyToken(token, {
        secretKey: config.clerkSecretKey,
        authorizedParties: [
          'https://dist-omega-lemon-8esrrbeklw.vercel.app',
          'http://localhost:5173',
        ],
      });
      if (payload.sub) {
        req.userId = payload.sub;
        return next();
      }
    } catch {}
  }

  res.status(401).json({ error: 'Unauthorized' });
}

export function getUserId(req: Request): string {
  return req.userId!;
}
