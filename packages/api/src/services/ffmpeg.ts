import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { CHUNK_DURATION_SEC, CHUNK_STEP_SEC } from "@mix-match/shared";

const exec = promisify(execFile);

export async function normalizeAudio(inputPath: string, outputPath: string): Promise<void> {
  await exec("ffmpeg", ["-i", inputPath, "-ar", "44100", "-f", "wav", "-y", outputPath]);
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

export async function splitIntoChunks(wavPath: string, outputDir: string, stepSec?: number): Promise<{ paths: string[]; positions: number[] }> {
  await fs.mkdir(outputDir, { recursive: true });

  const duration = await getDuration(wavPath);
  const positions = computeChunkPositions(duration, CHUNK_DURATION_SEC, stepSec ?? CHUNK_STEP_SEC);
  const paths: string[] = [];

  for (let i = 0; i < positions.length; i++) {
    const outFile = path.join(outputDir, `chunk_${String(i).padStart(4, "0")}.wav`);
    await exec("ffmpeg", [
      "-i", wavPath,
      "-ss", String(positions[i]),
      "-t", String(CHUNK_DURATION_SEC),
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

/**
 * Generate waveform data from a WAV file.
 * Returns an array of normalized amplitudes (0-1), one per second.
 */
export async function generateWaveform(wavPath: string): Promise<number[]> {
  const duration = await getDuration(wavPath);
  const pointCount = Math.ceil(duration);

  // Extract raw PCM at low sample rate (one sample per ~10ms = 100Hz)
  const { stdout } = await exec("ffmpeg", [
    "-i", wavPath,
    "-ac", "1",
    "-ar", "100",
    "-f", "s16le",
    "-",
  ], { encoding: "buffer", maxBuffer: 50 * 1024 * 1024 });

  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 2);
  const samplesPerPoint = Math.floor(samples.length / pointCount) || 1;

  // Calculate RMS per second
  const waveform: number[] = [];
  for (let i = 0; i < pointCount; i++) {
    const start = i * samplesPerPoint;
    const end = Math.min(start + samplesPerPoint, samples.length);
    let sumSq = 0;
    for (let j = start; j < end; j++) {
      sumSq += samples[j] * samples[j];
    }
    const rms = Math.sqrt(sumSq / (end - start || 1));
    waveform.push(rms);
  }

  // Normalize to 0-1
  const max = Math.max(...waveform) || 1;
  return waveform.map(v => Math.round((v / max) * 100) / 100);
}
