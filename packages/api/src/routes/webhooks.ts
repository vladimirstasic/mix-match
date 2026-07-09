import { type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { analyses } from '../db/schema.js';
import { verifyWebhookSignature, type FileScanFile } from '../services/acrcloud-filescan.js';
import { completeFileScanAnalysis, failFileScanAnalysis } from '../services/filescan-completion.js';

export async function acrcloudFilescanWebhookHandler(req: Request, res: Response) {
  const rawBody = req.body as Buffer;
  console.log(`[webhook:acrcloud-filescan] received, ${rawBody?.length ?? 0} bytes`);

  if (!verifyWebhookSignature(rawBody, req.headers as Record<string, string | undefined>)) {
    console.warn('[webhook:acrcloud-filescan] signature verification rejected the request');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let payload: { data?: FileScanFile | FileScanFile[] } & Partial<FileScanFile>;
  try {
    payload = JSON.parse(rawBody.toString());
  } catch {
    console.error('[webhook:acrcloud-filescan] failed to parse JSON body:', rawBody?.toString().slice(0, 500));
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  // ACRCloud's REST responses consistently wrap `data` in an array (confirmed against the
  // container's file-list and per-file endpoints) — handle both that and a bare object
  // defensively, since the webhook payload shape wasn't confirmed ahead of a live delivery.
  const rawData = payload.data ?? payload;
  const file = (Array.isArray(rawData) ? rawData[0] : rawData) as FileScanFile;
  if (!file?.id) {
    console.error('[webhook:acrcloud-filescan] payload missing file id:', JSON.stringify(payload).slice(0, 500));
    res.status(400).json({ error: 'Missing file id' });
    return;
  }

  console.log(`[webhook:acrcloud-filescan] file ${file.id} state=${file.state}`);

  const [analysis] = await db.select({ id: analyses.id }).from(analyses).where(eq(analyses.filescanFileId, file.id));

  if (!analysis) {
    console.warn(`[webhook:acrcloud-filescan] no analysis tracks file ${file.id} — ignoring`);
    res.json({ received: true });
    return;
  }

  try {
    if (file.state === 1) {
      await completeFileScanAnalysis(analysis.id, file);
      console.log(`[webhook:acrcloud-filescan] completed analysis ${analysis.id}`);
    } else if (file.state === -1 || file.state === -2 || file.state === -3) {
      await failFileScanAnalysis(analysis.id, `ACRCloud File Scanning returned state ${file.state}`, file.state);
      console.log(`[webhook:acrcloud-filescan] failed analysis ${analysis.id} (state ${file.state})`);
    }
    // state === 0 (still processing) — no-op, defensive case; shouldn't normally receive this.
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook:acrcloud-filescan] handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
