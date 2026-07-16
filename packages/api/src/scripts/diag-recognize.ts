// THROWAWAY DIAGNOSTIC — reproduces the analysis worker's recognition pipeline
// on a single file WITHOUT touching Postgres/Redis/Clerk, so we can read exactly
// what ACRCloud returns per chunk vs. what our aggregation produces.
//
// Run (from repo root, needs internet for ACRCloud + Spotify):
//   DOTENV_CONFIG_PATH=./.env npx tsx packages/api/src/scripts/diag-recognize.ts "<mp3path>" [stepSec] [maxChunks]
// Defaults: stepSec=120 (FAST), maxChunks=0 (all)
//
// Delete after diagnosis.
import 'dotenv/config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { normalizeAudio, splitIntoChunks, extractRmsLevels, formatTimestamp } from '../services/ffmpeg.js';
import { processChunksOptimized } from '../services/optimizer.js';
import { aggregateMatches, consolidateTimeline } from '../services/aggregator.js';

const mp3 = process.argv[2];
const stepSec = Number(process.argv[3] || 120);
const maxChunks = Number(process.argv[4] || 0);
if (!mp3) {
  console.error('usage: tsx diag-recognize.ts <mp3path> [stepSec=120] [maxChunks=0]');
  process.exit(1);
}

async function main() {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mm-diag-'));
  const wavPath = path.join(workDir, 'normalized.wav');
  const chunksDir = path.join(workDir, 'chunks');

  try {
    console.log(`[diag] normalizing ${mp3} (step=${stepSec}s, maxChunks=${maxChunks || 'all'})`);
    await normalizeAudio(mp3, wavPath);

    let { paths, positions } = await splitIntoChunks(wavPath, chunksDir, stepSec);
    if (maxChunks > 0) {
      paths = paths.slice(0, maxChunks);
      positions = positions.slice(0, maxChunks);
    }
    console.log(`[diag] ${paths.length} chunks — calling ACRCloud (watch [acr] lines below)…\n`);

    const rmsLevels = await extractRmsLevels(paths);
    const { matches, metrics } = await processChunksOptimized({
      chunkPaths: paths,
      chunkPositions: positions,
      rmsLevels,
      onProgress: () => {},
    });

    console.log(`\n===== RAW ACRCloud matches (${matches.length}) — what recognition returned =====`);
    for (const m of matches) {
      console.log(`@${formatTimestamp(m.startSec)}  score=${m.score}  ${m.artist} - ${m.title}  [acrid=${m.acrid}]`);
    }

    const results = consolidateTimeline(aggregateMatches(matches));
    console.log(`\n===== FINAL tracklist after aggregate+consolidate (${results.length}) =====`);
    for (const r of results) {
      console.log(`${r.start}-${r.end}  score=${r.score}  ${r.track}`);
    }

    console.log(`\n[diag] metrics: ${JSON.stringify(metrics)}`);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
