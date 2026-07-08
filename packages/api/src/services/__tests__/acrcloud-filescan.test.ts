import { describe, it, expect } from 'vitest';
import { mapFileScanResultToRawMatch, type FileScanMusicEntry } from '../acrcloud-filescan.js';

function entry(overrides: Partial<FileScanMusicEntry['result']> = {}, offset = 20): FileScanMusicEntry {
  return {
    offset,
    played_duration: 213,
    type: 'traverse',
    result: {
      title: 'Inside of Me',
      artists: [{ name: 'Arthur Deep' }],
      acrid: 'abc123',
      score: 99,
      duration_ms: 433000,
      genres: [{ name: 'Techno' }],
      album: { name: 'Some EP' },
      external_metadata: {
        spotify: { track: { id: 'sp123' } },
      },
      ...overrides,
    },
  };
}

describe('mapFileScanResultToRawMatch', () => {
  it('maps a well-formed high-score entry to a flat RawMatch', () => {
    const match = mapFileScanResultToRawMatch(entry());
    expect(match).toEqual({
      artist: 'Arthur Deep',
      title: 'Inside of Me',
      acrid: 'abc123',
      album: 'Some EP',
      score: 99,
      bpm: null,
      genre: 'Techno',
      durationMs: 433000,
      startSec: 20,
      externalLinks: { spotify: 'https://open.spotify.com/track/sp123' },
    });
  });

  it('uses entry.offset (file-timeline seconds), not a chunk index', () => {
    const match = mapFileScanResultToRawMatch(entry({}, 1247));
    expect(match?.startSec).toBe(1247);
  });

  it('rejects entries below the file-scan score floor', () => {
    const match = mapFileScanResultToRawMatch(entry({ score: 40 }));
    expect(match).toBeNull();
  });

  it('joins multiple artists with a comma', () => {
    const match = mapFileScanResultToRawMatch(entry({ artists: [{ name: 'A' }, { name: 'B' }] }));
    expect(match?.artist).toBe('A, B');
  });

  it('falls back to "Unknown" when artist/title are missing', () => {
    const match = mapFileScanResultToRawMatch(entry({ artists: undefined, title: undefined }));
    expect(match?.artist).toBe('Unknown');
    expect(match?.title).toBe('Unknown');
  });
});
