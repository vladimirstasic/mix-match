// Thin proxy: forwards social-media link-unfurling bots (Discord, Slack, WhatsApp,
// Twitter/X, Facebook, Telegram, LinkedIn — see vercel.json's user-agent match) to the
// API's own pre-rendered OG-meta-tag HTML for the requested tracklist/DJ profile, so
// shared links show the real mix/DJ instead of a generic homepage card. Real browsers
// never reach this function at all — they're served the SPA directly.
const API_BASE = process.env.VITE_API_URL || 'https://mix-match-production.up.railway.app/api';

export default async function handler(req, res) {
  const { type, id } = req.query;
  const path = type === 'tracklist' ? `/t/${id}/og` : type === 'dj' ? `/dj/${id}/og` : null;
  if (!path || !id) {
    res.status(404).send('Not found');
    return;
  }

  try {
    const upstream = await fetch(`${API_BASE}${path}`);
    const html = await upstream.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(upstream.status).send(html);
  } catch {
    res.status(502).send('Bad gateway');
  }
}
