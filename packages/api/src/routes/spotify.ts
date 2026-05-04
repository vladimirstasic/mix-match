import { Router } from "express";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { analyses, segments } from "../db/schema.js";

export const spotifyRouter = Router();

const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:3001/api/spotify/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// GET /api/spotify/auth?analysisId=xxx — redirect to Spotify login
spotifyRouter.get("/spotify/auth", (req, res) => {
  const analysisId = req.query.analysisId as string;
  if (!analysisId) {
    res.status(400).json({ error: "Missing analysisId" });
    return;
  }

  const scopes = "playlist-modify-public playlist-modify-private";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.spotify.clientId,
    scope: scopes,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: analysisId,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// GET /api/spotify/callback — Spotify returns auth code
spotifyRouter.get("/spotify/callback", async (req, res) => {
  const code = req.query.code as string;
  const analysisId = req.query.state as string;
  const error = req.query.error as string;

  if (error || !code) {
    res.redirect(`${FRONTEND_URL}?spotify=error`);
    return;
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[spotify] Token exchange failed:", await tokenRes.text());
      res.redirect(`${FRONTEND_URL}?spotify=error`);
      return;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get user profile
    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();

    // Get analysis and segments
    const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
    if (!analysis) {
      res.redirect(`${FRONTEND_URL}?spotify=error`);
      return;
    }

    const segs = await db.select().from(segments)
      .where(eq(segments.analysisId, analysisId))
      .orderBy(segments.startSec);

    // Collect Spotify URIs
    const trackUris: string[] = [];
    for (const seg of segs) {
      if (seg.status === "identified" && seg.externalLinks) {
        const links = seg.externalLinks as Record<string, string>;
        if (links.spotify) {
          const match = links.spotify.match(/track\/([a-zA-Z0-9]+)/);
          if (match) {
            const uri = `spotify:track:${match[1]}`;
            if (!trackUris.includes(uri)) trackUris.push(uri);
          }
        }
      }
    }

    if (trackUris.length === 0) {
      res.redirect(`${FRONTEND_URL}?spotify=error&reason=no_tracks`);
      return;
    }

    // Create playlist
    const playlistName = analysis.filename ? `${analysis.filename} — MixMatch` : "MixMatch Tracklist";
    const createRes = await fetch(`https://api.spotify.com/v1/users/${profile.id}/playlists`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: playlistName,
        description: `Tracklist identified by MixMatch — ${trackUris.length} tracks`,
        public: true,
      }),
    });

    if (!createRes.ok) {
      console.error("[spotify] Create playlist failed:", await createRes.text());
      res.redirect(`${FRONTEND_URL}?spotify=error`);
      return;
    }

    const playlist = await createRes.json();

    // Add tracks (Spotify allows max 100 per request)
    for (let i = 0; i < trackUris.length; i += 100) {
      const batch = trackUris.slice(i, i + 100);
      await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: batch }),
      });
    }

    console.log(`[spotify] Playlist created: ${playlist.external_urls.spotify} (${trackUris.length} tracks)`);

    const playlistUrl = encodeURIComponent(playlist.external_urls.spotify);
    res.redirect(`${FRONTEND_URL}?spotify=success&playlist=${playlistUrl}`);
  } catch (err) {
    console.error("[spotify] Error:", err);
    res.redirect(`${FRONTEND_URL}?spotify=error`);
  }
});
