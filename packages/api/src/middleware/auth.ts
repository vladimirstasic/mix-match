import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Store userId on request for handlers to use
  (req as any).userId = userId;
  next();
}

// Helper to get userId from request (set by requireUser middleware)
export function getUserId(req: Request): string {
  return (req as any).userId;
}
