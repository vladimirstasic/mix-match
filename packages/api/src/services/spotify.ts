import { config } from "../config.js";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return "";

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

export async function searchSpotifyTrack(artist: string, title: string): Promise<string | null> {
  if (!config.spotify.clientId || !config.spotify.clientSecret) {
    console.log(`[spotify] No credentials configured, skipping search`);
    return null;
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      console.log(`[spotify] Failed to get access token`);
      return null;
    }

    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.log(`[spotify] Search failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const track = data.tracks?.items?.[0];
    if (!track) {
      console.log(`[spotify] No results for "${artist} - ${title}"`);
      return null;
    }

    console.log(`[spotify] Found "${track.artists[0]?.name} - ${track.name}" for "${artist} - ${title}"`);
    return `https://open.spotify.com/track/${track.id}`;
  } catch (err) {
    console.log(`[spotify] Error:`, err);
    return null;
  }
}
