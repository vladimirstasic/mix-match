import { describe, it, expect } from "vitest";
import { computeChunkPositions } from "../ffmpeg.js";

describe("computeChunkPositions", () => {
  it("generates overlapping positions for a 60s file", () => {
    const positions = computeChunkPositions(60, 15, 10);
    expect(positions).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it("generates single chunk for short file", () => {
    const positions = computeChunkPositions(12, 15, 10);
    expect(positions).toEqual([0]);
  });

  it("handles exact multiple of step", () => {
    const positions = computeChunkPositions(30, 15, 10);
    expect(positions).toEqual([0, 10, 20]);
  });
});
