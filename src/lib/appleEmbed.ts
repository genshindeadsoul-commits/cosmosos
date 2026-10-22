export type AppleParse =
  | { ok: true; kind: 'album' | 'playlist'; storefront: string; embedUrl: string; openUrl: string }
  | { ok: false; error: string };

const STORE = /^[a-z]{2}$/;
const SLUG = /^[A-Za-z0-9%._~-]{1,200}$/;
const ALBUM_ID = /^\d{5,20}$/;
const PLAYLIST_ID = /^pl\.[A-Za-z0-9._-]{6,64}$/;
const UNSUPPORTED = new Set(['artist', 'song', 'station', 'music-video', 'curator', 'radio', 'show', 'episode', 'post', 'room', 'genre']);

/**
 * Accepts only https://music.apple.com (or embed.music.apple.com) album/playlist links and rebuilds the URL
 * from validated parts. Nothing from the pasted string is passed through except those parts.
 */
export function parseAppleMusicUrl(input: string): AppleParse {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Paste an Apple Music playlist or album link.' };
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, error: 'That doesn’t look like a link.' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'Use an https:// Apple Music link.' };
  if (u.hostname !== 'music.apple.com' && u.hostname !== 'embed.music.apple.com') return { ok: false, error: 'Only music.apple.com links are supported.' };
  const seg = u.pathname.split('/').filter(Boolean);
  const [store, type] = seg;
  if (!store || !STORE.test(store)) return { ok: false, error: 'The link is missing its country code (e.g. /us/).' };
  if (UNSUPPORTED.has(type)) return { ok: false, error: `Apple Music ${type} links can’t be embedded here. Use a playlist or album link.` };
  if (type !== 'album' && type !== 'playlist') return { ok: false, error: 'Only playlist and album links are supported.' };
  const id = seg[seg.length - 1];
  const slug = seg.length >= 4 ? seg[2] : type;
  if (seg.length < 3 || seg.length > 4) return { ok: false, error: 'This Apple Music link is incomplete.' };
  if (type === 'album' ? !ALBUM_ID.test(id) : !PLAYLIST_ID.test(id)) return { ok: false, error: `That ${type} link has an unrecognized ID.` };
  let decoded = '';
  try { decoded = decodeURIComponent(slug); } catch { return { ok: false, error: 'The link contains unsupported characters.' }; }
  if (!SLUG.test(slug) || /[<>"'`\\\u0000-\u001f\u007f]/.test(decoded)) return { ok: false, error: 'The link contains unsupported characters.' };
  const track = u.searchParams.get('i');
  const q = type === 'album' && track && /^\d{5,20}$/.test(track) ? `?i=${track}` : '';
  const path = `/${store}/${type}/${slug}/${id}${q}`;
  return { ok: true, kind: type, storefront: store, embedUrl: `https://embed.music.apple.com${path}`, openUrl: `https://music.apple.com${path}` };
}

export interface Box { x: number; y: number; w: number; h: number }
/** Keep a window fully reachable: at least the whole title bar stays inside the viewport. */
export function clampBox(b: Box, vw: number, vh: number, titleBar = 32, minW = 280, minH = 120): Box {
  const w = Math.min(Math.max(b.w, minW), Math.max(minW, vw));
  const h = Math.min(Math.max(b.h, minH), Math.max(minH, vh));
  return { w, h, x: Math.min(Math.max(b.x, 0), Math.max(0, vw - w)), y: Math.min(Math.max(b.y, 0), Math.max(0, vh - titleBar)) };
}
