import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampBox, parseAppleMusicUrl } from '../src/lib/appleEmbed.ts';
import { parseMusicLink } from '../src/lib/musicLinks.ts';
import {
  activeFrom,
  addPlaylist,
  enabledPlaylists,
  libraryFrom,
  MAX_PLAYLISTS,
  movePlaylist,
  PlaylistItem,
  removePlaylist,
  renamePlaylist,
  togglePlaylist,
} from '../src/lib/playlists.ts';
import { placePopover } from '../src/lib/popover.ts';

test('clampBox keeps the whole window reachable on resize and drag', () => {
  // Inside viewport: unchanged
  assert.deepEqual(clampBox({ x: 100, y: 100, w: 300, h: 200 }, 1000, 800, 32), { x: 100, y: 100, w: 300, h: 200 });
  // Off the left/top: clamped to 0
  assert.deepEqual(clampBox({ x: -50, y: -20, w: 300, h: 200 }, 1000, 800, 32), { x: 0, y: 0, w: 300, h: 200 });
  // Off the right/bottom: title bar always stays fully inside viewport
  const r = clampBox({ x: 950, y: 780, w: 300, h: 200 }, 1000, 800, 32);
  assert.equal(r.x, 700);
  assert.equal(r.y, 768);
  // Viewport smaller than widget min size: clamped to viewport with min constraints
  const small = clampBox({ x: 10, y: 10, w: 500, h: 500 }, 300, 300, 32);
  assert.ok(small.w <= 300);
  assert.ok(small.h <= 300);
});

test('apple: percent-encoded Unicode slugs from real links are allowed; encoded markup/quotes are not', () => {
  const p1 = parseAppleMusicUrl('https://music.apple.com/jp/playlist/%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AE/pl.u-11zBJEmt8jV0mK');
  assert.ok(p1.ok);
  assert.equal(p1.embedUrl, 'https://embed.music.apple.com/jp/playlist/%E3%81%AF%E3%81%98%E3%82%81%E3%81%A6%E3%81%AE/pl.u-11zBJEmt8jV0mK');

  const p2 = parseAppleMusicUrl('https://music.apple.com/us/album/folklore%20deluxe/1528112358');
  assert.ok(p2.ok);

  const bad = parseAppleMusicUrl('https://music.apple.com/us/playlist/%3Cscript%3E/pl.123');
  assert.equal(bad.ok, false);
});

test('music links: provider is identified and official embed URL is rebuilt for Apple Music', () => {
  const pl = parseMusicLink('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb');
  assert.ok(pl.ok && pl.provider === 'apple' && pl.kind === 'playlist');
  assert.equal(pl.embedUrl, 'https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb');

  const song = parseMusicLink('https://music.apple.com/us/song/cardigan/1528112363');
  assert.ok(song.ok && song.kind === 'track');

  const album = parseMusicLink('https://music.apple.com/us/album/folklore/1528112358');
  assert.ok(album.ok && album.kind === 'album');
});

test('music links: unsupported services or Spotify links are refused with clear messages', () => {
  const err = (u: string) => {
    const r = parseMusicLink(u);
    assert.equal(r.ok, false, u);
    return (r as { error: string }).error;
  };

  assert.match(err(''), /Paste/);
  assert.match(err('not a url'), /link/);
  assert.match(err('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), /Spotify is not supported/);
  assert.match(err('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'), /Spotify is not supported/);
  assert.match(err('https://spotify.link/abc123'), /Spotify is not supported/);
  assert.match(err('https://www.youtube.com/playlist?list=PLabc'), /aren’t supported/);
  assert.match(err('https://soundcloud.com/a/sets/b'), /aren’t supported/);
  assert.match(err('https://example.com/playlist/abc'), /Only Apple Music/);
});

const mk = (id: string, over: Partial<PlaylistItem> = {}): PlaylistItem => ({
  id,
  name: `Playlist ${id}`,
  provider: 'apple',
  kind: 'playlist',
  openUrl: `https://music.apple.com/us/playlist/p-${id}/pl.${id.repeat(4)}`,
  embedUrl: `https://embed.music.apple.com/us/playlist/p-${id}/pl.${id.repeat(4)}`,
  enabled: true,
  ...over,
});

test('playlist library: add validates, names default sensibly, duplicates and the cap are enforced', () => {
  let lib: PlaylistItem[] = [];
  const bad = addPlaylist(lib, 'https://youtube.com/x', '', 'id1');
  assert.equal(bad.ok, false);

  const r = addPlaylist(lib, 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb', '  Focus\u0007  ', 'id1');
  assert.ok(r.ok);
  lib = (r as any).lib;
  assert.equal(lib[0].name, 'Focus');
  assert.equal(lib[0].enabled, true);

  const dup = addPlaylist(lib, 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb', 'Again', 'id2');
  assert.equal(dup.ok, false);
  assert.match((dup as any).error, /Already in your list as “Focus”/);

  const unnamed = addPlaylist(lib, 'https://music.apple.com/gb/album/folklore/1528112358', '', 'id3');
  assert.ok(unnamed.ok);
  assert.equal((unnamed as any).item.name, 'Apple Music album');

  const full = Array.from({ length: MAX_PLAYLISTS }, (_, i) => mk(`p${i}`));
  assert.match((addPlaylist(full, 'https://music.apple.com/us/playlist/x/pl.1234567890123456', '', 'x') as any).error, /up to 50/);
});

test('playlist library: rename, enable/disable, reorder and remove behave and never mutate the input', () => {
  const lib = [mk('a'), mk('b'), mk('c')];
  const copy = JSON.stringify(lib);
  assert.deepEqual(movePlaylist(lib, 'c', -1).map((p) => p.id), ['a', 'c', 'b']);
  assert.deepEqual(movePlaylist(lib, 'a', -1).map((p) => p.id), ['a', 'b', 'c']);
  assert.deepEqual(movePlaylist(lib, 'c', 1).map((p) => p.id), ['a', 'b', 'c']);
  assert.deepEqual(movePlaylist(lib, 'zzz', 1), lib);
  assert.equal(renamePlaylist(lib, 'b', ' New ')[1].name, 'New');
  assert.equal(renamePlaylist(lib, 'b', '   ')[1].name, 'Playlist b');
  assert.equal(togglePlaylist(lib, 'a')[0].enabled, false);
  assert.deepEqual(removePlaylist(lib, 'b').map((p) => p.id), ['a', 'c']);
  assert.equal(JSON.stringify(lib), copy);
});

test('only ENABLED playlists are playable; the active one falls back sensibly; legacy single-link setting migrated', () => {
  const lib = [mk('a', { enabled: false }), mk('b'), mk('c')];
  assert.deepEqual(enabledPlaylists(lib).map((p) => p.id), ['b', 'c']);
  assert.equal(activeFrom({ playlists: lib, activePlaylistId: 'c' })!.id, 'c');
  assert.equal(activeFrom({ playlists: lib, activePlaylistId: 'a' })!.id, 'b');
  assert.equal(activeFrom({ playlists: lib })!.id, 'b');
  assert.equal(activeFrom({ playlists: [mk('a', { enabled: false })] }), null);
  assert.equal(activeFrom({}), null);

  const migrated = libraryFrom({ appleMusic: { url: 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb' } });
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].enabled, true);
  assert.equal(migrated[0].provider, 'apple');

  assert.deepEqual(libraryFrom({ playlists: [], appleMusic: { url: 'https://music.apple.com/us/album/x/1528112358' } }), []);
});

test('popover placement: placePopover positions below, flips above, clamps, and uses bottom sheet on mobile', () => {
  // Mobile (< 480px width): always returns bottom sheet
  const mobile = placePopover({ top: 100, bottom: 130, left: 200, right: 250, width: 50, height: 30 }, { width: 200, height: 150 }, { width: 360, height: 740 });
  assert.equal(mobile.isSheet, true);
  assert.equal(mobile.x, 8);
  assert.equal(mobile.width, 360 - 16);

  // Desktop: normal placement below anchor
  const desktop = placePopover({ top: 100, bottom: 130, left: 500, right: 600, width: 100, height: 30 }, { width: 220, height: 150 }, { width: 1200, height: 800 });
  assert.equal(desktop.isSheet, false);
  assert.equal(desktop.y, 138); // 130 + 8 margin
  assert.equal(desktop.x, 600 - 220); // right-aligned

  // Desktop near bottom: flips above
  const nearBottom = placePopover({ top: 720, bottom: 750, left: 500, right: 600, width: 100, height: 30 }, { width: 220, height: 150 }, { width: 1200, height: 800 });
  assert.equal(nearBottom.isSheet, false);
  assert.equal(nearBottom.y, 720 - 150 - 8); // flipped above

  // Clamped to left viewport boundary
  const nearLeft = placePopover({ top: 100, bottom: 130, left: 10, right: 50, width: 40, height: 30 }, { width: 200, height: 100 }, { width: 1000, height: 800 });
  assert.equal(nearLeft.x, 8); // clamped to margin
});
