import { describe, it, expect } from 'vitest';
import { computeChunkPositions } from '../ffmpeg.js';

describe('computeChunkPositions', () => {
  it('generates positions for a 60s file with 10s step', () => {
    const positions = computeChunkPositions(60, 10, 10);
    expect(positions).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('generates single chunk for short file', () => {
    const positions = computeChunkPositions(8, 10, 10);
    expect(positions).toEqual([0]);
  });

  it('handles exact multiple of step', () => {
    const positions = computeChunkPositions(30, 10, 10);
    expect(positions).toEqual([0, 10, 20]);
  });

  it('works with overlap', () => {
    const positions = computeChunkPositions(60, 15, 10);
    expect(positions).toEqual([0, 10, 20, 30, 40, 50]);
  });
});
