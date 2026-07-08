import { eq } from 'drizzle-orm';
import { clerkClient } from '@clerk/express';
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

// Creates the user row on first sighting, populating email/name from Clerk. A no-op if the row
// already exists — profile fields are captured once, not kept in sync with later Clerk edits.
export async function ensureUser(clerkId: string): Promise<void> {
  const existing = await findUser(clerkId);
  if (existing) return;

  let email: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    firstName = clerkUser.firstName;
    lastName = clerkUser.lastName;
    const primaryEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
    email = primaryEmail?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
  } catch (err) {
    console.error(`[ensureUser] failed to fetch Clerk profile for ${clerkId}:`, err);
  }

  await db.insert(users).values({ clerkId, email, firstName, lastName }).onConflictDoNothing();
}

export async function getAnalysisSegments(analysisId: string) {
  return db.select().from(segments).where(eq(segments.analysisId, analysisId)).orderBy(segments.startSec);
}
