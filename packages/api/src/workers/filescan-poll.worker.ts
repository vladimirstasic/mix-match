import { Worker, Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { FILESCAN_POLL_FALLBACK_DELAY_MS, FILESCAN_POLL_MAX_ATTEMPTS } from '@mix-match/shared';
import { redis } from '../queue/index.js';
import { filescanPollQueue } from '../queue/filescan-poll.js';
import { db } from '../db/client.js';
import { analyses } from '../db/schema.js';
import { fetchFileScanFile } from '../services/acrcloud-filescan.js';
import { completeFileScanAnalysis, failFileScanAnalysis } from '../services/filescan-completion.js';

interface FilescanPollData {
  analysisId: string;
  attempt: number;
}

const worker = new Worker<FilescanPollData>(
  'filescan-poll',
  async (job: Job<FilescanPollData>) => {
    const { analysisId, attempt } = job.data;

    const [analysis] = await db
      .select({ status: analyses.status, filescanFileId: analyses.filescanFileId })
      .from(analyses)
      .where(eq(analyses.id, analysisId));

    if (!analysis || analysis.status === 'completed' || analysis.status === 'failed') {
      // Webhook already completed this analysis (expected common case).
      return;
    }

    if (!analysis.filescanFileId) {
      await failFileScanAnalysis(analysisId, 'Missing ACRCloud File Scanning file id');
      return;
    }

    const file = await fetchFileScanFile(analysis.filescanFileId);

    if (!file || file.state === -1 || file.state === -2 || file.state === -3) {
      await failFileScanAnalysis(
        analysisId,
        `ACRCloud File Scanning returned state ${file?.state ?? 'unknown'}`,
        file?.state,
      );
      return;
    }

    if (file.state === 1) {
      await completeFileScanAnalysis(analysisId, file);
      return;
    }

    // Still processing (state === 0)
    if (attempt >= FILESCAN_POLL_MAX_ATTEMPTS) {
      await failFileScanAnalysis(analysisId, 'File scan timed out — no result from ACRCloud');
      return;
    }

    await filescanPollQueue.add(
      'poll-filescan',
      { analysisId, attempt: attempt + 1 },
      { delay: FILESCAN_POLL_FALLBACK_DELAY_MS },
    );
  },
  { connection: redis, concurrency: 5 },
);

worker.on('ready', () => console.log('Filescan poll worker ready'));
worker.on('failed', (job, err) => console.error(`Filescan poll job ${job?.id} failed:`, err.message));

export default worker;
