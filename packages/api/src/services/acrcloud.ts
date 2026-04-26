import crypto from "crypto";
import fs from "fs/promises";
import { ACRCLOUD_RETRY_COUNT, ACRCLOUD_RETRY_BASE_DELAY_MS, ACRCLOUD_MIN_SCORE } from "@mix-match/shared";
import type { RawMatch, ExternalLinks } from "@mix-match/shared";
import { config } from "../config.js";

export function buildSignature(stringToSign: string, accessSecret: string): string {
  return crypto.createHmac("sha1", accessSecret).update(stringToSign).digest("base64");
}

export class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "RateLimitError";
  }
}

export async function identifyChunk(chunkPath: string, startSec: number): Promise<RawMatch | null> {
  const fileBuffer = await fs.readFile(chunkPath);
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `POST\n/v1/identify\n${config.acrcloud.accessKey}\naudio\n1\n${timestamp}`;
  const signature = buildSignature(stringToSign, config.acrcloud.accessSecret);

  const formData = new FormData();
  formData.append("access_key", config.acrcloud.accessKey);
  formData.append("sample_bytes", String(fileBuffer.length));
  formData.append("sample", new Blob([fileBuffer]), "chunk.wav");
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("data_type", "audio");
  formData.append("signature_version", "1");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < ACRCLOUD_RETRY_COUNT; attempt++) {
    try {
      const response = await fetch(`https://${config.acrcloud.host}/v1/identify`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.status?.code === 0 && data.metadata?.music?.length > 0) {
        const track = data.metadata.music[0];
        const score = track.score ?? 0;
        const artist = track.artists?.map((a: { name: string }) => a.name).join(", ") || "Unknown";
        const title = track.title || "Unknown";

        if (score < ACRCLOUD_MIN_SCORE) {
          console.log(`[acr] @${startSec}s: "${artist} - ${title}" score=${score} ✗ (below ${ACRCLOUD_MIN_SCORE})`);
          return null;
        }

        console.log(`[acr] @${startSec}s: "${artist} - ${title}" score=${score} ✓`);

        const externalLinks: ExternalLinks = {};
        const ext = track.external_metadata;
        if (ext?.spotify?.track?.id) {
          externalLinks.spotify = `https://open.spotify.com/track/${ext.spotify.track.id}`;
        }
        if (ext?.youtube?.vid) {
          externalLinks.youtube = `https://youtube.com/watch?v=${ext.youtube.vid}`;
        }
        if (ext?.deezer?.track?.id) {
          externalLinks.deezer = `https://www.deezer.com/track/${ext.deezer.track.id}`;
        }

        return {
          artist,
          title,
          acrid: track.acrid || "",
          album: track.album?.name,
          score,
          startSec,
          externalLinks: Object.keys(externalLinks).length > 0 ? externalLinks : undefined,
        };
      }

      if (data.status?.code === 1001) {
        return null;
      }

      // Rate limit — don't retry, throw immediately
      if (data.status?.code === 3003 || data.status?.msg?.includes("limit")) {
        throw new RateLimitError(`ACRCloud: ${data.status.msg}`);
      }

      if (data.status?.code >= 3000 || !response.ok) {
        throw new Error(`ACRCloud error: ${data.status?.msg || response.statusText}`);
      }

      return null;
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      lastError = err as Error;
      if (attempt < ACRCLOUD_RETRY_COUNT - 1) {
        const delay = ACRCLOUD_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}
