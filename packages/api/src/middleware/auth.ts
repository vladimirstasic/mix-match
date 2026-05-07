import { getAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function decodeJwtPayload(token: string): { sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    return payload;
  } catch {
    return null;
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
    const payload = decodeJwtPayload(authHeader.slice(7));
    if (payload?.sub) {
      req.userId = payload.sub;
      return next();
    }
  }

  res.status(401).json({ error: 'Unauthorized' });
}

export function getUserId(req: Request): string {
  return req.userId!;
}
