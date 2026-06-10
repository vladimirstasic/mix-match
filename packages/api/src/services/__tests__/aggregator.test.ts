import { describe, it, expect } from 'vitest';
import { aggregateMatches, isSameTrack, normalizeString, consolidateTimeline, looseTrackKey } from '../aggregator.js';
import type { TrackMatch } from '@mix-match/shared';
import kengardenOutput from '../__fixtures__/kengarden-015-output.json';

describe('normalizeString', () => {
  it('removes parenthetical suffixes', () => {
    expect(normalizeString('Around the World (Radio Edit)')).toBe('around the world');
  });

  it('removes bracketed suffixes', () => {
    expect(normalizeString('Pictures [Remastered]')).toBe('pictures');
  });

  it('collapses whitespace', () => {
    expect(normalizeString('  Hello   World  ')).toBe('hello world');
  });

  it('strips "feat. X" suffix', () => {
    expect(normalizeString('More Heavy feat. Kaleta')).toBe('more heavy');
  });

  it('strips "ft. X" suffix', () => {
    expect(normalizeString('Track ft. Someone')).toBe('track');
  });

  it('strips "featuring X" suffix', () => {
    expect(normalizeString('Track featuring Someone Else')).toBe('track');
  });

  it('strips artist comma suffix', () => {
    expect(normalizeString('Bosq, Kaleta')).toBe('bosq');
  });

  it('strips parens-feat from title', () => {
    expect(normalizeString('More Heavy (feat. Kaleta)')).toBe('more heavy');
  });
});

describe('isSameTrack', () => {
  it('matches by acrid', () => {
    expect(
      isSameTrack(
        { artist: 'A', title: 'X', acrid: '123', startSec: 0 },
        { artist: 'B', title: 'Y', acrid: '123', startSec: 10 },
      ),
    ).toBe(true);
  });

  it('matches by normalized title when acrid differs', () => {
    expect(
      isSameTrack(
        { artist: 'Daft Punk', title: 'Around the World', acrid: 'a1', startSec: 0 },
        { artist: 'Daft Punk', title: 'Around the World (Radio Edit)', acrid: 'a2', startSec: 10 },
      ),
    ).toBe(true);
  });

  it('does not match different songs', () => {
    expect(
      isSameTrack(
        { artist: 'Daft Punk', title: 'Around the World', acrid: 'a1', startSec: 0 },
        { artist: 'Chemical Brothers', title: 'Block Rockin Beats', acrid: 'b1', startSec: 10 },
      ),
    ).toBe(false);
  });

  it('matches by Spotify track ID even with different artist/title text', () => {
    expect(
      isSameTrack(
        {
          artist: 'Bosq',
          title: 'More Heavy',
          acrid: 'a1',
          startSec: 0,
          externalLinks: { spotify: 'https://open.spotify.com/track/abc123' },
        },
        {
          artist: 'Bosq feat. Kaleta',
          title: 'More Heavy feat. Kaleta',
          acrid: 'a2',
          startSec: 10,
          externalLinks: { spotify: 'https://open.spotify.com/track/abc123' },
        },
      ),
    ).toBe(true);
  });

  it('matches feat. variants by normalized text', () => {
    expect(
      isSameTrack(
        { artist: 'Bosq, Kaleta', title: 'More Heavy', acrid: 'a1', startSec: 0 },
        { artist: 'Bosq', title: 'More Heavy feat. Kaleta', acrid: 'a2', startSec: 10 },
      ),
    ).toBe(true);
  });

  it('matches by Deezer track ID', () => {
    expect(
      isSameTrack(
        {
          artist: 'A',
          title: 'X',
          acrid: 'a1',
          startSec: 0,
          externalLinks: { deezer: 'https://www.deezer.com/track/12345' },
        },
        {
          artist: 'B',
          title: 'Y',
          acrid: 'a2',
          startSec: 10,
          externalLinks: { deezer: 'https://www.deezer.com/track/12345' },
        },
      ),
    ).toBe(true);
  });
});

describe('aggregateMatches', () => {
  it('merges consecutive identical matches', () => {
    const result = aggregateMatches([
      { artist: 'Daft Punk', title: 'Around the World', acrid: 'a', startSec: 0 },
      { artist: 'Daft Punk', title: 'Around the World', acrid: 'a', startSec: 10 },
      { artist: 'Daft Punk', title: 'Around the World', acrid: 'a', startSec: 20 },
      { artist: 'Chemical Brothers', title: 'Block Rockin Beats', acrid: 'b', startSec: 30 },
    ]);

    expect(result).toEqual([
      {
        track: 'Daft Punk - Around the World',
        start: '00:00',
        end: '00:35',
        acrid: 'a',
        bpm: null,
        genre: null,
        musicalKey: null,
        score: null,
        externalLinks: undefined,
      },
      {
        track: 'Chemical Brothers - Block Rockin Beats',
        start: '00:30',
        end: '00:45',
        acrid: 'b',
        bpm: null,
        genre: null,
        musicalKey: null,
        score: null,
        externalLinks: undefined,
      },
    ]);
  });

  it('merges same acrid with different titles', () => {
    const result = aggregateMatches([
      { artist: 'Daft Punk', title: 'Around the World', acrid: 'a', startSec: 0 },
      { artist: 'Daft Punk', title: 'Around the World', acrid: 'a', startSec: 10 },
      { artist: 'Daft Punk', title: 'Around the World (Radio Edit)', acrid: 'a', startSec: 20 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].start).toBe('00:00');
    expect(result[0].end).toBe('00:35');
    expect(result[0].acrid).toBe('a');
  });

  it('merges fuzzy matching titles with different acrids', () => {
    const result = aggregateMatches([
      { artist: 'Hatikvah', title: 'Unforgettable', acrid: 'a1', startSec: 0 },
      { artist: 'Hatikvah', title: 'Unforgettable (Long Version)', acrid: 'a2', startSec: 10 },
      { artist: 'Hatikvah', title: 'Unforgettable', acrid: 'a1', startSec: 20 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].start).toBe('00:00');
    expect(result[0].end).toBe('00:35');
  });

  it('handles single match', () => {
    const result = aggregateMatches([{ artist: 'Artist', title: 'Song', acrid: 'x', startSec: 0 }]);
    expect(result).toEqual([
      {
        track: 'Artist - Song',
        start: '00:00',
        end: '00:15',
        acrid: 'x',
        bpm: null,
        genre: null,
        musicalKey: null,
        score: null,
        externalLinks: undefined,
      },
    ]);
  });

  it('handles empty input', () => {
    expect(aggregateMatches([])).toEqual([]);
  });

  it('merges 4 feat. metadata variants of the same track into one segment', () => {
    const result = aggregateMatches([
      { artist: 'Bosq, Kaleta', title: 'More Heavy', acrid: 'a1', startSec: 0 },
      { artist: 'Bosq', title: 'More Heavy (feat. Kaleta)', acrid: 'a2', startSec: 120 },
      { artist: 'Bosq feat. Kaleta', title: 'More Heavy feat. Kaleta', acrid: 'a3', startSec: 240 },
      { artist: 'Bosq', title: 'More Heavy feat. Kaleta', acrid: 'a4', startSec: 360 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].start).toBe('00:00');
    expect(result[0].end).toBe('06:15');
  });
});

describe('looseTrackKey', () => {
  it('treats comma and slash artist separators as equal', () => {
    expect(looseTrackKey('Presi On, Spijker - What Remains')).toBe(looseTrackKey('Presi On/Spijker - What Remains'));
  });

  it('ignores extended/original mix suffixes', () => {
    expect(looseTrackKey('Mosoo - Day After Day - Extended Mix')).toBe(looseTrackKey('Mosoo - Day After Day'));
    expect(looseTrackKey('NICK ROBERTS - Mami (Extended Mix)')).toBe(
      looseTrackKey('NICK ROBERTS - Mami (Original Mix)'),
    );
  });

  it('keeps remix as a distinct track', () => {
    expect(looseTrackKey('A - Song')).not.toBe(looseTrackKey('A - Song (Someone Remix)'));
  });
});

describe('consolidateTimeline (K:ENGARDEN 015 real fixture)', () => {
  const consolidated = consolidateTimeline(kengardenOutput as TrackMatch[]);
  const count = (substr: string) =>
    consolidated.filter(s => s.track.toLowerCase().includes(substr.toLowerCase())).length;

  it('collapses each split track to a single segment', () => {
    expect(count('Piero Farho - Time')).toBe(1);
    expect(count('What Remains')).toBe(1); // Presi On x5 -> 1
    expect(count('Journey')).toBe(1); // Palane x5 -> 1
    expect(count('NICK ROBERTS')).toBe(1); // Mami x3 -> 1
    expect(count('Day After Day')).toBe(1); // Mosoo x5 -> 1
    expect(count('McFly - Silhouette')).toBe(1); // x3 -> 1
    expect(count('HADi DANS')).toBe(1); // x2 -> 1
    expect(count('Never Be Alone')).toBe(1); // x2 -> 1
    expect(count('Your Love')).toBe(1); // Alessandro x2 -> 1
    expect(count('No Hesitation')).toBe(1); // Sentin x2 -> 1
    expect(count('THE FUTURE')).toBe(1); // Ankhoi x2 -> 1
  });

  it('keeps a genuine far-apart replay separate (OPERA at 0:00 and 104:00)', () => {
    expect(count('OPERA')).toBe(2);
  });

  it('cuts the segment count well below the raw 71', () => {
    expect(consolidated.length).toBeLessThan(50);
    expect(consolidated.length).toBeGreaterThan(20);
  });

  it('extends a consolidated segment across its full span', () => {
    const piero = consolidated.find(s => s.track.includes('Piero Farho'));
    expect(piero?.start).toBe('21:30');
    expect(piero?.end).toBe('27:45');
  });
});
