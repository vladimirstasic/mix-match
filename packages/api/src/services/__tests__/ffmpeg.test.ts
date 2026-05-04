import { describe, it, expect } from 'vitest';
import { formatTimestamp } from '../ffmpeg.js';

describe('ffmpeg utils', () => {
  it('formats seconds to mm:ss', () => {
    expect(formatTimestamp(0)).toBe('00:00');
    expect(formatTimestamp(32)).toBe('00:32');
    expect(formatTimestamp(130)).toBe('02:10');
    expect(formatTimestamp(3661)).toBe('61:01');
  });
});
