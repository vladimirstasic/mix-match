import { execFile } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import { FINGERPRINT_SIMILARITY_THRESHOLD } from "@mix-match/shared";

const exec = promisify(execFile);

export async function generateFingerprint(chunkPath: string): Promise<Buffer> {
  const { stdout } = await exec(
    "ffmpeg",
    ["-i", chunkPath, "-f", "s16le", "-ac", "1", "-ar", "11025", "-"],
    { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 }
  );

  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 2);

  const windowSize = Math.floor(samples.length / 5);
  const peakData: number[] = [];

  for (let w = 0; w < 5; w++) {
    const start = w * windowSize;
    const end = Math.min(start + windowSize, samples.length);
    const window = samples.slice(start, end);

    const bandSize = Math.floor(window.length / 32);
    const bands: number[] = [];
    for (let b = 0; b < 32; b++) {
      let energy = 0;
      for (let i = b * bandSize; i < (b + 1) * bandSize && i < window.length; i++) {
        energy += window[i] * window[i];
      }
      bands.push(energy);
    }

    const topBands = bands
      .map((e, i) => ({ e, i }))
      .sort((a, b) => b.e - a.e)
      .slice(0, 5)
      .map((x) => x.i);

    peakData.push(...topBands);
  }

  return crypto.createHash("md5").update(Buffer.from(peakData)).digest();
}

export function hammingDistance(a: Buffer, b: Buffer): number {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = a[i] ^ b[i];
    while (xor) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

export function isSimilar(a: Buffer, b: Buffer, threshold = FINGERPRINT_SIMILARITY_THRESHOLD): boolean {
  const totalBits = a.length * 8;
  const dist = hammingDistance(a, b);
  const similarity = 1 - dist / totalBits;
  return similarity >= threshold;
}
