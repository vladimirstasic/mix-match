import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { CHUNK_DURATION_SEC, CHUNK_STEP_SEC } from "@mix-match/shared";

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

export function computeChunkPositions(durationSec: number, chunkDuration: number, stepSec: number): number[] {
  const positions: number[] = [];
  for (let pos = 0; pos <= durationSec - stepSec; pos += stepSec) {
    positions.push(pos);
  }
  if (positions.length === 0) {
    positions.push(0);
  }
  return positions;
}

export async function splitIntoChunks(wavPath: string, outputDir: string): Promise<{ paths: string[]; positions: number[] }> {
  await fs.mkdir(outputDir, { recursive: true });

  const duration = await getDuration(wavPath);
  const positions = computeChunkPositions(duration, CHUNK_DURATION_SEC, CHUNK_STEP_SEC);
  const paths: string[] = [];

  for (let i = 0; i < positions.length; i++) {
    const outFile = path.join(outputDir, `chunk_${String(i).padStart(4, "0")}.wav`);
    await exec("ffmpeg", [
      "-ss", String(positions[i]),
      "-i", wavPath,
      "-t", String(CHUNK_DURATION_SEC),
      "-c", "copy",
      "-y",
      outFile,
    ]);
    paths.push(outFile);
  }

  return { paths, positions };
}

export async function extractRmsLevels(_wavPath: string, chunkCount: number, chunkPaths: string[]): Promise<number[]> {
  const rmsValues: number[] = [];

  for (const chunkPath of chunkPaths) {
    try {
      const { stderr } = await exec("ffmpeg", [
        "-i", chunkPath,
        "-af", "volumedetect",
        "-f", "null",
        "-",
      ], { maxBuffer: 10 * 1024 * 1024 });

      const match = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
      if (match) {
        rmsValues.push(parseFloat(match[1]));
      } else {
        rmsValues.push(-Infinity);
      }
    } catch {
      rmsValues.push(-Infinity);
    }
  }

  return rmsValues;
}

export function formatTimestamp(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
