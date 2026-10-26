import { MusicKind, MusicProvider, parseMusicLink, PROVIDER_LABEL } from './musicLinks';

export interface PlaylistItem { id: string; name: string; provider: MusicProvider; kind: MusicKind; openUrl: string; embedUrl: string; enabled: boolean }
export interface PlaylistPrefs { playlists?: PlaylistItem[]; activePlaylistId?: string; appleMusic?: { url?: string | null } }
export const MAX_PLAYLISTS = 50;

/** The user's library. A playlist saved by the earlier single-link widget is carried over (enabled), not lost. */
export function libraryFrom(prefs: PlaylistPrefs): PlaylistItem[] {
  if (prefs.playlists) return prefs.playlists;
  const legacy = prefs.appleMusic?.url ? parseMusicLink(prefs.appleMusic.url) : null;
  if (legacy?.ok) return [{ id: 'legacy-apple-music', name: `Apple Music ${legacy.kind}`, provider: legacy.provider, kind: legacy.kind, openUrl: legacy.openUrl, embedUrl: legacy.embedUrl, enabled: true }];
  return [];
}

/** Only enabled playlists are ever offered for playback. Nothing is discovered from the user's account. */
export const enabledPlaylists = (lib: PlaylistItem[]) => lib.filter((p) => p.enabled);
export function activeFrom(prefs: PlaylistPrefs): PlaylistItem | null {
  const on = enabledPlaylists(libraryFrom(prefs));
  return on.find((p) => p.id === prefs.activePlaylistId) ?? on[0] ?? null;
}

export function addPlaylist(lib: PlaylistItem[], link: string, name: string, id: string): { ok: true; lib: PlaylistItem[]; item: PlaylistItem } | { ok: false; error: string } {
  const r = parseMusicLink(link);
  if (!r.ok) return r;
  if (lib.length >= MAX_PLAYLISTS) return { ok: false, error: `You can keep up to ${MAX_PLAYLISTS} playlists. Remove one first.` };
  const dup = lib.find((p) => p.openUrl === r.openUrl);
  if (dup) return { ok: false, error: `Already in your list as “${dup.name}”.` };
  const item: PlaylistItem = { id, name: cleanName(name) || `${PROVIDER_LABEL[r.provider]} ${r.kind}`, provider: r.provider, kind: r.kind, openUrl: r.openUrl, embedUrl: r.embedUrl, enabled: true };
  return { ok: true, lib: [...lib, item], item };
}
export const cleanName = (n: string) => n.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
export const renamePlaylist = (lib: PlaylistItem[], id: string, name: string) => { const n = cleanName(name); return n ? lib.map((p) => (p.id === id ? { ...p, name: n } : p)) : lib; };
export const togglePlaylist = (lib: PlaylistItem[], id: string) => lib.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
export const removePlaylist = (lib: PlaylistItem[], id: string) => lib.filter((p) => p.id !== id);
export function movePlaylist(lib: PlaylistItem[], id: string, dir: -1 | 1) {
  const i = lib.findIndex((p) => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= lib.length) return lib;
  const next = [...lib]; [next[i], next[j]] = [next[j], next[i]];
  return next;
}
