import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { TrackMatch } from '@mix-match/shared';

const client = config.anthropicApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

// One cheap LLM call per completed scan (cached in analyses.summary), not per page view.
// No-ops entirely until ANTHROPIC_API_KEY is set.
export async function generateMixSummary(results: TrackMatch[]): Promise<string | null> {
  if (!client || results.length === 0) return null;

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
    if (block?.type !== 'text') return null;
    return block.text.trim() || null;
  } catch (err) {
    console.error('[mix-summary] generation failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
