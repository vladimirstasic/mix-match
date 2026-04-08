import { describe, it, expect } from "vitest";
import { aggregateMatches } from "../aggregator.js";

describe("aggregator", () => {
  it("merges consecutive identical matches", () => {
    const result = aggregateMatches([
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 30 },
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 45 },
      { artist: "Daft Punk", title: "Around the World", acrid: "a", startSec: 60 },
      { artist: "Chemical Brothers", title: "Block Rockin Beats", acrid: "b", startSec: 75 },
    ]);

    expect(result).toEqual([
      { track: "Daft Punk - Around the World", start: "00:30", end: "01:15" },
      { track: "Chemical Brothers - Block Rockin Beats", start: "01:15", end: "01:30" },
    ]);
  });

  it("handles single match", () => {
    const result = aggregateMatches([
      { artist: "Artist", title: "Song", acrid: "x", startSec: 0 },
    ]);
    expect(result).toEqual([
      { track: "Artist - Song", start: "00:00", end: "00:15" },
    ]);
  });

  it("handles empty input", () => {
    expect(aggregateMatches([])).toEqual([]);
  });
});
