import { callFn } from './integrationsApi';

/** Remote control of an already-open Spotify device via the Web API. Access tokens live in memory only. */
let cached: { token: string; expiresAt: number } | null = null;

async function token(force = false): Promise<string> {
  if (!force && cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const r = await callFn<{ access_token: string; expires_in: number }>('spotify-token');
  cached = { token: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 };
  return cached.token;
}
export const clearSpotifyToken = () => { cached = null; };

export class SpotifyError extends Error { constructor(public code: string, message: string) { super(message); } }

async function api(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await token()}` } });
  if (res.status === 401 && retry) { await token(true); return api(path, init, false); }
  if (res.status === 429) throw new SpotifyError('rate_limited', 'Spotify is rate-limiting requests. Try again in a moment.');
  if (res.status === 404) throw new SpotifyError('no_device', 'No active Spotify device. Open Spotify on a phone or computer and start playing, then try again.');
  if (res.status === 403) throw new SpotifyError('premium_required', 'Spotify Premium is required to control playback.');
  if (!res.ok && res.status !== 204) throw new SpotifyError('error', `Spotify returned ${res.status}.`);
  return res;
}

export interface SpotifyState { isPlaying: boolean; track: string; artist: string; progressSec: number; durationSec: number; device?: string }

export async function getSpotifyState(): Promise<SpotifyState | null> {
  const res = await fetch('https://api.spotify.com/v1/me/player', { headers: { Authorization: `Bearer ${await token()}` } });
  if (res.status === 204) return null;                           // nothing playing / no device
  if (res.status === 401) { clearSpotifyToken(); throw new SpotifyError('auth', 'Spotify session expired.'); }
  if (!res.ok) throw new SpotifyError('error', `Spotify returned ${res.status}.`);
  const j = await res.json();
  return { isPlaying: !!j.is_playing, track: j.item?.name ?? 'Nothing playing', artist: (j.item?.artists ?? []).map((a: any) => a.name).join(', '),
    progressSec: Math.floor((j.progress_ms ?? 0) / 1000), durationSec: Math.floor((j.item?.duration_ms ?? 0) / 1000), device: j.device?.name };
}
export const spotifyPlay = () => api('/me/player/play', { method: 'PUT' });
export const spotifyPause = () => api('/me/player/pause', { method: 'PUT' });
export const spotifyNext = () => api('/me/player/next', { method: 'POST' });
export const spotifyPrevious = () => api('/me/player/previous', { method: 'POST' });
