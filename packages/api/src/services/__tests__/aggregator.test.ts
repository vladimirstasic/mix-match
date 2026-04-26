import { describe, it, expect } from "vitest";
import { aggregateMatches, isSameTrack, normalizeString } from "../aggregator.js";

describe("normalizeString", () => {
  it("removes parenthetical suffixes", () => {
    expect(normalizeString("Around the World (Radio Edit)")).toBe("around the world");
  });

  it("removes bracketed suffixes", () => {
    expect(normalizeString("Pictures [Remastered]")).toBe("pictures");
  });

  it("collapses whitespace", () => {
    expect(normalizeString("  Hello   World  ")).toBe("hello world");
  });
});

describe("isSameTrack", () => {
  it("matches by acrid", () => {
    expect(isSameTrack(
      { artist: "A", title: "X", acrid: "123", startSec: 0 },
      { artist: "B", title: "Y", acrid: "123", startSec: 10 },
    )).toBe(true);
  });

  it("matches by normalized title when acrid differs", () => {
    expect(isSameTrack(
      { artist: "Daft Punk", title: "Around the World", acrid: "a1", startSec: 0 },
      { artist: "Daft Punk", title: "Around the World (Radio Edit)", acrid: "a2", startSec: 10 },
    )).toBe(true);
  });

  it("does not match different songs", () => {
    expect(isSameTrack(
      { artist: "Daft Punk", title: "Around the World", acrid: "a1", startSec: 0 },
      { artist: "Chemical Brothers", title: "Block Rockin Beats", acrid: "b1", startSec: 10 },
    )).toBe(false);
  });
});

describe("aggregateMatches", () => {
  it("merges consecutive identical matches", () => {
    const result = aggregateMatches([
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 0 },
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 10 },
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 20 },
      { artist: "Chemical Brothers", title: "Block Rockin Beats", acrid: "b", startSec: 30 },
    ]);

    expect(result).toEqual([
      { track: "Daft Punk - Around the World", start: "00:00", end: "00:30", acrid: "a" },
      { track: "Chemical Brothers - Block Rockin Beats", start: "00:30", end: "00:40", acrid: "b" },
    ]);
  });

  it("merges same acrid with different titles", () => {
    const result = aggregateMatches([
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 0 },
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 10 },
      { artist: "Daft Punk", title: "Around the World (Radio Edit)", acrid: "a", startSec: 20 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].start).toBe("00:00");
    expect(result[0].end).toBe("00:30");
    expect(result[0].acrid).toBe("a");
  });

  it("merges fuzzy matching titles with different acrids", () => {
    const result = aggregateMatches([
      { artist: "Hatikvah", title: "Unforgettable", acrid: "a1", startSec: 0 },
      { artist: "Hatikvah", title: "Unforgettable (Long Version)", acrid: "a2", startSec: 10 },
      { artist: "Hatikvah", title: "Unforgettable", acrid: "a1", startSec: 20 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].start).toBe("00:00");
    expect(result[0].end).toBe("00:30");
  });

  it("handles single match", () => {
    const result = aggregateMatches([
      { artist: "Artist", title: "Song", acrid: "x", startSec: 0 },
    ]);
    expect(result).toEqual([
      { track: "Artist - Song", start: "00:00", end: "00:10", acrid: "x" },
    ]);
  });

  it("handles empty input", () => {
    expect(aggregateMatches([])).toEqual([]);
  });
});
