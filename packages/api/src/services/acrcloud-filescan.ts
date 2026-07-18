import crypto from 'crypto';
import fs from 'fs/promises';
import { ACRCLOUD_FILESCAN_MIN_SCORE } from '@mix-match/shared';
import type { RawMatch } from '@mix-match/shared';
import { config } from '../config.js';
import { extractExternalLinks, enrichExternalLinks } from './acrcloud.js';

function baseUrl(): string {
  return `https://api-${config.acrcloud.filescan.region}.acrcloud.com/api/fs-containers/${config.acrcloud.filescan.containerId}`;
}

function requireBearerToken(): string {
  if (!config.acrcloud.filescan.bearerToken) {
    throw new Error('ACRCLOUD_CONSOLE_TOKEN not configured');
  }
  return config.acrcloud.filescan.bearerToken;
}

export interface FileScanMusicEntry {
  offset: number;
  played_duration: number;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
}

export interface FileScanFile {
  id: string;
  state: number;
  duration?: number;
  results?: {
    music?: FileScanMusicEntry[];
  };
}

export async function uploadToFileScan(filePath: string, filename: string): Promise<{ fileId: string; state: number }> {
  const token = requireBearerToken();
  const fileBuffer = await fs.readFile(filePath);
  console.log(`[acrcloud-filescan] uploading "${filename}", read ${fileBuffer.length} bytes from disk`);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), filename);
  formData.append('data_type', 'audio');

  const response = await fetch(`${baseUrl()}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`ACRCloud File Scanning upload failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const file = data.data ?? data;
  console.log(
    `[acrcloud-filescan] ACRCloud accepted upload: id=${file.id} duration=${file.duration} state=${file.state}`,
  );
  return { fileId: file.id, state: file.state };
}

// ACRCloud fetches the media itself for these platforms — no local download/re-upload, so the
// truncation risk we've seen with large manually-downloaded files doesn't apply here.
export async function uploadPlatformUrlToFileScan(url: string): Promise<{ fileId: string; state: number }> {
  const token = requireBearerToken();
  console.log(`[acrcloud-filescan] submitting platform url "${url}"`);

  const response = await fetch(`${baseUrl()}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_type: 'platforms', url }),
  });

  if (!response.ok) {
    throw new Error(`ACRCloud File Scanning platform submission failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const file = data.data ?? data;
  console.log(
    `[acrcloud-filescan] ACRCloud accepted platform url: id=${file.id} duration=${file.duration} state=${file.state}`,
  );
  return { fileId: file.id, state: file.state };
}

// Confirmed against a live response: this endpoint wraps the result in `data` as a one-element
// array, same shape as the list endpoint — not a bare object.
export async function fetchFileScanFile(fileId: string): Promise<FileScanFile | null> {
  const token = requireBearerToken();

  const response = await fetch(`${baseUrl()}/files/${fileId}?with_result=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`ACRCloud File Scanning status check failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const files: FileScanFile[] = Array.isArray(data.data) ? data.data : [data.data];
  return files.find(f => f.id === fileId) ?? files[0] ?? null;
}

// One-time container setup — not called from any request path.
export async function registerWebhook(callbackUrl: string, signSecret: string): Promise<void> {
  const token = requireBearerToken();

  const response = await fetch(
    `https://api-v2.acrcloud.com/api/fs-containers/${config.acrcloud.filescan.containerId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callback_url: callbackUrl,
        callback_sign_secret: { kid: 'mix-match', secret: signSecret },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ACRCloud webhook registration failed: ${response.status} ${response.statusText}`);
  }
}

let warnedNoSignature = false;

// TODO(verify): confirm actual header name/algorithm against a live webhook once
// callback_sign_secret is configured. Until then this logs once and allows the request through —
// correlation by filescanFileId on the analyses row is the fallback trust boundary.
export function verifyWebhookSignature(_rawBody: Buffer, _headers: Record<string, string | undefined>): boolean {
  if (!config.acrcloud.filescan.webhookSecret) {
    if (!warnedNoSignature) {
      console.warn(
        '[acrcloud-filescan] webhook signature verification disabled — ACRCLOUD_FILESCAN_WEBHOOK_SECRET not set',
      );
      warnedNoSignature = true;
    }
    return true;
  }
  // TODO: implement HMAC verification once ACRCloud's header/algorithm is confirmed.
  return true;
}

export function mapFileScanResultToRawMatch(entry: FileScanMusicEntry): RawMatch | null {
  const r = entry.result;
  const score = r?.score ?? 0;
  if (score < ACRCLOUD_FILESCAN_MIN_SCORE) return null;

  const artist = r.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown';
  const title = r.title || 'Unknown';

  return {
    artist,
    title,
    acrid: r.acrid || '',
    album: r.album?.name,
    score,
    bpm: r.bpm ?? null,
    genre: r.genres?.[0]?.name ?? null,
    durationMs: r.duration_ms ?? null,
    startSec: entry.offset,
    externalLinks: extractExternalLinks(r.external_metadata),
  };
}

export async function mapAndEnrichFileScanResults(entries: FileScanMusicEntry[]): Promise<RawMatch[]> {
  const matches: RawMatch[] = [];
  for (const entry of entries) {
    const match = mapFileScanResultToRawMatch(entry);
    if (!match) continue;

    const { externalLinks, musicalKey } = await enrichExternalLinks(
      match.artist,
      match.title,
      match.externalLinks ?? {},
    );
    matches.push({
      ...match,
      externalLinks: Object.keys(externalLinks).length > 0 ? externalLinks : undefined,
      musicalKey,
    });
  }
  return matches;
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}
