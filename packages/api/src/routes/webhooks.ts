import { type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { analyses } from '../db/schema.js';
import { verifyWebhookSignature, type FileScanFile } from '../services/acrcloud-filescan.js';
import { completeFileScanAnalysis, failFileScanAnalysis } from '../services/filescan-completion.js';

export async function acrcloudFilescanWebhookHandler(req: Request, res: Response) {
  const rawBody = req.body as Buffer;

  if (!verifyWebhookSignature(rawBody, req.headers as Record<string, string | undefined>)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let payload: { data?: FileScanFile } & Partial<FileScanFile>;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const file = (payload.data ?? payload) as FileScanFile;
  if (!file?.id) {
    res.status(400).json({ error: 'Missing file id' });
    return;
  }

  const [analysis] = await db.select({ id: analyses.id }).from(analyses).where(eq(analyses.filescanFileId, file.id));

  if (!analysis) {
    // Webhook for a container file we don't track (e.g. manual test upload) — ignore.
    res.json({ received: true });
    return;
  }

  try {
    if (file.state === 1) {
      await completeFileScanAnalysis(analysis.id, file);
    } else if (file.state === -1 || file.state === -2 || file.state === -3) {
      await failFileScanAnalysis(analysis.id, `ACRCloud File Scanning returned state ${file.state}`, file.state);
    }
    // state === 0 (still processing) — no-op, defensive case; shouldn't normally receive this.
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook:acrcloud-filescan] handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
