import { describe, it, expect } from 'vitest';
import { aggregateMatches, isSameTrack, normalizeString, squashAdjacentDuplicates } from '../aggregator.js';
import type { TrackMatch } from '@mix-match/shared';

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

describe('squashAdjacentDuplicates', () => {
  const seg = (track: string, start: string, end: string, extra: Partial<TrackMatch> = {}): TrackMatch => ({
    track,
    start,
    end,
    acrid: undefined,
    bpm: null,
    genre: null,
    musicalKey: null,
    score: null,
    ...extra,
  });

  it('returns empty for empty input', () => {
    expect(squashAdjacentDuplicates([])).toEqual([]);
  });

  it('returns single segment unchanged', () => {
    const input = [seg('Daft Punk - Around the World', '00:00', '03:00')];
    const result = squashAdjacentDuplicates(input);
    expect(result).toHaveLength(1);
    expect(result[0].track).toBe('Daft Punk - Around the World');
  });

  it('merges noise-interrupted same-track segments within window', () => {
    // [A, B, A] with B sandwiched within 60s of both — A's collapse via
    // lookback through recent segments. B remains in place; A is extended
    // to cover the second A's end.
    const input = [
      seg('Daft Punk - Around the World', '00:00', '02:00', { acrid: 'a' }),
      seg('Some - Other Track', '02:10', '02:25', { acrid: 'b' }),
      seg('Daft Punk - Around the World', '02:30', '05:00', { acrid: 'a' }),
    ];
    const result = squashAdjacentDuplicates(input, 60);
    expect(result).toHaveLength(2);
    expect(result.map(s => s.track)).toEqual(['Daft Punk - Around the World', 'Some - Other Track']);
    expect(result[0].start).toBe('00:00');
    expect(result[0].end).toBe('05:00');
  });

  it('merges two consecutive same-track segments separated by short gap', () => {
    const input = [
      seg('Daft Punk - Around the World', '00:00', '02:00', { acrid: 'a' }),
      seg('Daft Punk - Around the World (Extended)', '02:30', '04:00', { acrid: 'a' }),
    ];
    const result = squashAdjacentDuplicates(input, 60);
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe('00:00');
    expect(result[0].end).toBe('04:00');
  });

  it('keeps two same-track segments apart when gap exceeds window', () => {
    // DJ legitimately replays the track 30 minutes later
    const input = [
      seg('Daft Punk - Around the World', '00:00', '03:00', { acrid: 'a' }),
      seg('Daft Punk - Around the World', '30:00', '33:00', { acrid: 'a' }),
    ];
    const result = squashAdjacentDuplicates(input, 60);
    expect(result).toHaveLength(2);
  });

  it('merges by Spotify ID even when titles differ slightly', () => {
    const input = [
      seg('Mwofly - Silhouette', '10:00', '12:00', {
        externalLinks: { spotify: 'https://open.spotify.com/track/abc123' },
      }),
      seg('Mwofly - Silhouette (Extended Mix)', '12:15', '15:00', {
        externalLinks: { spotify: 'https://open.spotify.com/track/abc123' },
      }),
    ];
    const result = squashAdjacentDuplicates(input, 60);
    expect(result).toHaveLength(1);
    expect(result[0].end).toBe('15:00');
  });

  it('promotes higher-scoring metadata onto merged segment but keeps earlier start', () => {
    const input = [seg('Track A', '00:00', '02:00', { score: 50 }), seg('Track A', '02:30', '04:00', { score: 90 })];
    const result = squashAdjacentDuplicates(input, 60);
    expect(result).toHaveLength(1);
    expect(result[0].start).toBe('00:00');
    expect(result[0].end).toBe('04:00');
    expect(result[0].score).toBe(90);
  });

  it('does not merge different tracks even when adjacent', () => {
    const input = [
      seg('Daft Punk - Around the World', '00:00', '02:00', { acrid: 'a' }),
      seg('Some - Other Track', '02:10', '04:00', { acrid: 'b' }),
    ];
    const result = squashAdjacentDuplicates(input, 60);
    expect(result).toHaveLength(2);
  });
});
