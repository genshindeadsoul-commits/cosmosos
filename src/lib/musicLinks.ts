import { parseAppleMusicUrl } from './appleEmbed';

export type MusicProvider = 'apple' | 'spotify';
export type MusicKind = 'playlist' | 'album' | 'track';
export type MusicLinkParse =
  | { ok: true; provider: MusicProvider; kind: MusicKind; openUrl: string; embedUrl: string }
  | { ok: false; error: string };

export const PROVIDER_LABEL: Record<MusicProvider, string> = { apple: 'Apple Music', spotify: 'Spotify' };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_UNSUPPORTED = new Set(['artist', 'show', 'episode', 'user', 'genre', 'concert', 'collection']);

function parseSpotify(raw: string): MusicLinkParse {
  // spotify:playlist:<id> URIs
  const uri = raw.match(/^spotify:(playlist|album|track):([A-Za-z0-9]+)$/);
  if (uri) return build(uri[1] as 'playlist' | 'album' | 'track', uri[2]);
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, error: 'That doesn’t look like a link.' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'Use an https:// Spotify link.' };
  if (u.hostname === 'spotify.link' || u.hostname === 'spotify.app.link') return { ok: false, error: 'Short Spotify links can’t be checked. Open it in Spotify, choose Share → Copy link, and paste the open.spotify.com link.' };
  if (u.hostname !== 'open.spotify.com') return { ok: false, error: 'Only open.spotify.com links are supported.' };
  const seg = u.pathname.split('/').filter(Boolean);
  if (seg[0]?.startsWith('intl-')) seg.shift();                 // /intl-in/playlist/<id>
  if (seg[0] === 'embed') seg.shift();
  const [type, id] = seg;
  if (SPOTIFY_UNSUPPORTED.has(type)) return { ok: false, error: `Spotify ${type} links can’t be played here. Use a playlist, album, or track link.` };
  if (type !== 'playlist' && type !== 'album' && type !== 'track') return { ok: false, error: 'Only Spotify playlist, album, and track links are supported.' };
  return build(type, id);
}
function build(kind: 'playlist' | 'album' | 'track', id: string | undefined): MusicLinkParse {
  if (!id || !SPOTIFY_ID.test(id)) return { ok: false, error: `That Spotify ${kind} link has an unrecognized ID.` };
  return { ok: true, provider: 'spotify', kind, openUrl: `https://open.spotify.com/${kind}/${id}`, embedUrl: `https://open.spotify.com/embed/${kind}/${id}` };
}

/** Identifies the provider and rebuilds the official embed URL from validated parts only. */
export function parseMusicLink(input: string): MusicLinkParse {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Paste a playlist, album, or track link.' };
  if (/^spotify:/i.test(raw)) return parseSpotify(raw);
  let host = '';
  try { host = new URL(raw).hostname; } catch { return { ok: false, error: 'That doesn’t look like a link.' }; }
  if (host === 'open.spotify.com' || host.endsWith('spotify.link') || host.endsWith('spotify.app.link')) return parseSpotify(raw);
  if (host === 'music.apple.com' || host === 'embed.music.apple.com') {
    const r = parseAppleMusicUrl(raw);
    return r.ok ? { ok: true, provider: 'apple', kind: r.kind === 'song' ? 'track' : r.kind, openUrl: r.openUrl, embedUrl: r.embedUrl } : r;
  }
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)soundcloud\.com$|(^|\.)deezer\.com$|(^|\.)tidal\.com$|(^|\.)music\.amazon\./.test(host)) {
    return { ok: false, error: `${host} links aren’t supported. Cosmos OS can play Apple Music and Spotify links.` };
  }
  return { ok: false, error: 'Only Apple Music (music.apple.com) and Spotify (open.spotify.com) links are supported.' };
}
