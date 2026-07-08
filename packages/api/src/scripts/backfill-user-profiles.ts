// Backfills email/first_name/last_name for users whose profile fields are still empty (e.g. rows
// created before ensureUser() started populating them, or new Clerk instances/imports).
// Safe to re-run — only touches rows missing all three fields, matches ensureUser()'s primary-email
// selection logic.
//
//   DOTENV_CONFIG_PATH=./.env npx tsx packages/api/src/scripts/backfill-user-profiles.ts
import 'dotenv/config';
import { isNull, and, eq } from 'drizzle-orm';
import { clerkClient } from '@clerk/express';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

async function main() {
  const rows = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(and(isNull(users.email), isNull(users.firstName), isNull(users.lastName)));

  console.log(`Found ${rows.length} user(s) missing profile fields.`);

  let updated = 0;
  let failed = 0;

  for (const { clerkId } of rows) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const primaryEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
      const email = primaryEmail?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;

      await db
        .update(users)
        .set({ email, firstName: clerkUser.firstName, lastName: clerkUser.lastName })
        .where(eq(users.clerkId, clerkId));

      console.log(`  ✓ ${clerkId} -> ${email ?? '(no email)'} ${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`);
      updated++;
    } catch (err) {
      console.error(`  ✗ ${clerkId}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\nDone. Updated ${updated}, failed ${failed}.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
