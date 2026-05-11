import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import { findAnalysis, getAnalysisSegments } from '../db/helpers.js';
import { redis } from '../queue/index.js';
import { requireUser } from '../middleware/auth.js';

export const spotifyRouter = Router();

const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3001/api/spotify/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// POST /api/spotify/prepare — store playlist selection before OAuth
spotifyRouter.post('/spotify/prepare', requireUser, async (req, res) => {
  const { analysisId, playlistName, selectedUris } = req.body;
  if (!analysisId || !selectedUris || !Array.isArray(selectedUris)) {
    res.status(400).json({ error: 'Missing analysisId or selectedUris' });
    return;
  }

  const token = crypto.randomUUID();
  await redis.set(`spotify:prepare:${token}`, JSON.stringify({ analysisId, playlistName, selectedUris }), 'EX', 600);

  res.json({ token });
});

// GET /api/spotify/auth?token=xxx — redirect to Spotify login
spotifyRouter.get('/spotify/auth', (req, res) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const scopes = 'playlist-modify-public playlist-modify-private';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.spotify.clientId,
    scope: scopes,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: token,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// GET /api/spotify/callback — Spotify returns auth code
spotifyRouter.get('/spotify/callback', async (req, res) => {
  const code = req.query.code as string;
  const token = req.query.state as string;
  const error = req.query.error as string;

  if (error || !code || !token) {
    res.redirect(`${FRONTEND_URL}?spotify=error`);
    return;
  }

  try {
    // Read stored selection
    const stored = await redis.get(`spotify:prepare:${token}`);
    if (!stored) {
      res.redirect(`${FRONTEND_URL}?spotify=error&reason=expired`);
      return;
    }
    await redis.del(`spotify:prepare:${token}`);
    const { playlistName, selectedUris } = JSON.parse(stored);

    // Exchange code for access token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      res.redirect(`${FRONTEND_URL}?spotify=error`);
      return;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user profile
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();

    // Create playlist
    const createRes = await fetch(`https://api.spotify.com/v1/users/${profile.id}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: playlistName || 'MixMatch Tracklist',
        description: `Tracklist identified by MixMatch — ${selectedUris.length} tracks`,
        public: true,
      }),
    });

    if (!createRes.ok) {
      res.redirect(`${FRONTEND_URL}?spotify=error`);
      return;
    }

    const playlist = await createRes.json();

    // Add tracks (max 100 per request)
    for (let i = 0; i < selectedUris.length; i += 100) {
      const batch = selectedUris.slice(i, i + 100);
      await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: batch }),
      });
    }

    const playlistUrl = encodeURIComponent(playlist.external_urls.spotify);
    res.redirect(`${FRONTEND_URL}?spotify=success&playlist=${playlistUrl}`);
  } catch (err) {
    console.error('[spotify] Error:', err);
    res.redirect(`${FRONTEND_URL}?spotify=error`);
  }
});
