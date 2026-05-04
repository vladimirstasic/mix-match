import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { analyses, segments, users } from './schema.js';

export async function findAnalysis(id: string) {
  const [row] = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  return row ?? null;
}

export async function findSegment(id: string) {
  const [row] = await db.select().from(segments).where(eq(segments.id, id)).limit(1);
  return row ?? null;
}

export async function findUser(clerkId: string) {
  const [row] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return row ?? null;
}

export async function getAnalysisSegments(analysisId: string) {
  return db.select().from(segments).where(eq(segments.analysisId, analysisId)).orderBy(segments.startSec);
}
