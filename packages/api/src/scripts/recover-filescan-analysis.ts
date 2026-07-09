// THROWAWAY RECOVERY SCRIPT — manually completes an analysis that finished on ACRCloud's side but
// never got picked up locally (missed webhook, or the fallback poll gave up before ACRCloud
// finished). Bypasses the webhook/poll queue entirely: fetches the file's current state directly
// and runs the same completion logic the webhook handler uses.
//
//   DOTENV_CONFIG_PATH=./.env npx tsx packages/api/src/scripts/recover-filescan-analysis.ts <analysisId>
//
// Requires ACRCLOUD_CONSOLE_TOKEN and DATABASE_URL pointed at the environment where the analysis
// row lives (production, typically — set these inline on the command rather than editing .env).
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { analyses } from '../db/schema.js';
import { fetchFileScanFile } from '../services/acrcloud-filescan.js';
import { completeFileScanAnalysis, failFileScanAnalysis } from '../services/filescan-completion.js';

async function main() {
  const analysisId = process.argv[2];
  if (!analysisId) {
    console.error('usage: recover-filescan-analysis.ts <analysisId>');
    process.exit(1);
  }

  const [analysis] = await db
    .select({ filescanFileId: analyses.filescanFileId, status: analyses.status })
    .from(analyses)
    .where(eq(analyses.id, analysisId));

  if (!analysis) {
    console.error(`No analysis found with id ${analysisId}`);
    process.exit(1);
  }
  if (!analysis.filescanFileId) {
    console.error(`Analysis ${analysisId} has no filescanFileId — not a filescan-engine analysis`);
    process.exit(1);
  }

  console.log(`Current status: ${analysis.status}. Fetching ACRCloud file ${analysis.filescanFileId}...`);

  const file = await fetchFileScanFile(analysis.filescanFileId);
  if (!file) {
    console.error('ACRCloud returned no file for that id.');
    process.exit(1);
  }

  console.log(`ACRCloud state: ${file.state}`);

  if (file.state === 1) {
    await completeFileScanAnalysis(analysisId, file);
    console.log('Completed successfully.');
  } else if (file.state === -1 || file.state === -2 || file.state === -3) {
    await failFileScanAnalysis(analysisId, `ACRCloud File Scanning returned state ${file.state}`, file.state);
    console.log('Marked as failed (ACRCloud reported an error/no-result state).');
  } else {
    console.log('ACRCloud still reports this file as processing (state 0) — nothing to recover yet.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
