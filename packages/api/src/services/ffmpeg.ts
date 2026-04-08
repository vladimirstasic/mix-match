import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { CHUNK_DURATION_SEC } from "@mix-detective/shared";

const exec = promisify(execFile);

export async function normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
  await exec("ffmpeg", ["-i", inputPath, "-ac", "1", "-ar", "44100", "-f", "wav", "-y", outputPath]);
}

export async function getDuration(filePath: string): Promise<number> {
  const { stdout } = await exec("ffprobe", [
    "-v", "quiet",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}

export async function splitIntoChunks(wavPath: string, outputDir: string): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const pattern = path.join(outputDir, "chunk_%04d.wav");
  await exec("ffmpeg", [
    "-i", wavPath,
    "-f", "segment",
    "-segment_time", String(CHUNK_DURATION_SEC),
    "-c", "copy",
    "-y",
    pattern,
  ]);

  const files = await fs.readdir(outputDir);
  return files
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
    .sort()
    .map((f) => path.join(outputDir, f));
}

export async function extractRmsLevels(wavPath: string, chunkCount: number): Promise<number[]> {
  const samplesPerChunk = 44100 * CHUNK_DURATION_SEC;
  const { stderr } = await exec("ffmpeg", [
    "-i", wavPath,
    "-af", `astats=metadata=1:reset=${samplesPerChunk}`,
    "-f", "null",
    "-",
  ]);

  const rmsValues: number[] = [];
  const lines = stderr.split("\n");
  for (const line of lines) {
    const match = line.match(/RMS level dB:\s*([-\d.]+)/);
    if (match) {
      rmsValues.push(parseFloat(match[1]));
    }
  }

  while (rmsValues.length < chunkCount) {
    rmsValues.push(-Infinity);
  }

  return rmsValues.slice(0, chunkCount);
}

export function formatTimestamp(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
