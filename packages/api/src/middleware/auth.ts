import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

export function getUserId(req: Request): string {
  return req.userId!;
}
