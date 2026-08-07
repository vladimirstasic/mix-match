import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { TrackMatch } from '@mix-match/shared';

const client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

// Deterministic one-liner from the same facts, used when no LLM key is configured or the
// call fails. The share page needs *some* description, and this reads better than the
// truncated track list it would otherwise fall back to.
function templateSummary(count: number, genres: string[], bpmRange: string | null, artists: string[]): string {
  const head = `${count} ${count === 1 ? 'track' : 'tracks'} identified in this mix`;
  const detail = [
    genres.length > 0 ? genres.slice(0, 3).join(', ').toLowerCase() : null,
    bpmRange,
    artists.length > 0 ? `featuring ${artists.slice(0, 3).join(', ')}` : null,
  ].filter(Boolean);

  return detail.length > 0 ? `${head} — ${detail.join(', ')}.` : `${head}.`;
}

// One cheap LLM call per completed scan (cached in analyses.summary), not per page view.
// Falls back to templateSummary when ANTHROPIC_API_KEY is unset, so share pages always
// have a description.
export async function generateMixSummary(results: TrackMatch[]): Promise<string | null> {
  if (results.length === 0) return null;

  const genres = [...new Set(results.map(r => r.genre).filter((g): g is string => !!g))];
  const bpms = results.map(r => r.bpm).filter((b): b is number => typeof b === 'number');
  const bpmRange = bpms.length > 0 ? `${Math.min(...bpms)}-${Math.max(...bpms)} BPM` : null;
  const artists = [...new Set(results.map(r => r.track.split(' - ')[0]).filter(Boolean))].slice(0, 8);

  const facts = [
    `${results.length} tracks identified`,
    genres.length > 0 ? `genres: ${genres.slice(0, 5).join(', ')}` : null,
    bpmRange,
    artists.length > 0 ? `artists include: ${artists.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  if (!client) return templateSummary(results.length, genres, bpmRange, artists);

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `Write exactly one short, engaging sentence describing this DJ mix for a shareable tracklist page, based on these facts: ${facts}. No preamble, no quotes, just the sentence.`,
        },
      ],
    });
    const block = message.content[0];
    if (block?.type !== 'text') return templateSummary(results.length, genres, bpmRange, artists);
    return block.text.trim() || templateSummary(results.length, genres, bpmRange, artists);
  } catch (err) {
    console.error('[mix-summary] generation failed:', err instanceof Error ? err.message : err);
    return templateSummary(results.length, genres, bpmRange, artists);
  }
}
