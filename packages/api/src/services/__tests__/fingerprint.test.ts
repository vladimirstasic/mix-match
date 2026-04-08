import { describe, it, expect } from "vitest";
import { hammingDistance, isSimilar } from "../fingerprint.js";

describe("fingerprint", () => {
  it("computes hamming distance between two buffers", () => {
    const a = Buffer.from([0b11110000, 0b10101010]);
    const b = Buffer.from([0b11110000, 0b10101010]);
    expect(hammingDistance(a, b)).toBe(0);
  });

  it("detects differing bits", () => {
    const a = Buffer.from([0b11110000]);
    const b = Buffer.from([0b11111111]);
    expect(hammingDistance(a, b)).toBe(4);
  });

  it("isSimilar returns true for identical fingerprints", () => {
    const fp = Buffer.from([0b11110000, 0b10101010]);
    expect(isSimilar(fp, fp, 0.85)).toBe(true);
  });
});
