import { parseAppleMusicUrl } from './appleEmbed';

export type MusicProvider = 'apple';
export type MusicKind = 'playlist' | 'album' | 'track';
export type MusicLinkParse =
  | { ok: true; provider: MusicProvider; kind: MusicKind; openUrl: string; embedUrl: string }
  | { ok: false; error: string };

export const PROVIDER_LABEL: Record<MusicProvider, string> = { apple: 'Apple Music' };

/** Identifies the provider and rebuilds the official embed URL from validated parts only. Apple Music only. */
export function parseMusicLink(input: string): MusicLinkParse {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Paste an Apple Music playlist, album, or song link.' };
  if (/^spotify:/i.test(raw)) {
    return { ok: false, error: 'Spotify is not supported. Cosmos OS supports Apple Music playlists.' };
  }
  let host = '';
  try { host = new URL(raw).hostname; } catch { return { ok: false, error: 'That doesn’t look like a link.' }; }
  if (host === 'open.spotify.com' || host.endsWith('spotify.link') || host.endsWith('spotify.app.link')) {
    return { ok: false, error: 'Spotify is not supported. Cosmos OS supports Apple Music playlists.' };
  }
  if (host === 'music.apple.com' || host === 'embed.music.apple.com') {
    const r = parseAppleMusicUrl(raw);
    return r.ok ? { ok: true, provider: 'apple', kind: r.kind === 'song' ? 'track' : r.kind, openUrl: r.openUrl, embedUrl: r.embedUrl } : r;
  }
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)soundcloud\.com$|(^|\.)deezer\.com$|(^|\.)tidal\.com$|(^|\.)music\.amazon\./.test(host)) {
    return { ok: false, error: `${host} links aren’t supported. Cosmos OS supports Apple Music playlists.` };
  }
  return { ok: false, error: 'Only Apple Music (music.apple.com) links are supported.' };
}
