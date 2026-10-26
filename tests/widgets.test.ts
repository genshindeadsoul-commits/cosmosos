import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppleMusicUrl, clampBox } from '../src/lib/appleEmbed.ts';
import { parseMusicLink } from '../src/lib/musicLinks.ts';
import { addPlaylist, libraryFrom, activeFrom, enabledPlaylists, movePlaylist, removePlaylist, renamePlaylist, togglePlaylist, MAX_PLAYLISTS, type PlaylistItem } from '../src/lib/playlists.ts';
import { sanitizeFilename, base64UrlToBlob, mergeUnique, replySubject, senderAddress, senderName, quoteForReply, formatBytes, isFolderId, FOLDERS } from '../src/lib/mail.ts';

const ok = (u: string) => { const r = parseAppleMusicUrl(u); assert.ok(r.ok, u); return r as Extract<typeof r, { ok: true }>; };
const bad = (u: string) => { const r = parseAppleMusicUrl(u); assert.equal(r.ok, false, u); return (r as { error: string }).error; };

test('apple: playlist and album links become official embed URLs', () => {
  assert.equal(ok('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb').embedUrl, 'https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb');
  assert.equal(ok('https://music.apple.com/gb/album/folklore/1528112358').kind, 'album');
  assert.equal(ok('https://music.apple.com/in/album/some-name/1528112358').storefront, 'in');
  assert.equal(ok('https://embed.music.apple.com/us/album/x/1528112358').embedUrl, 'https://embed.music.apple.com/us/album/x/1528112358');
  assert.equal(ok('  https://music.apple.com/us/playlist/p/pl.u-abc123def456  ').kind, 'playlist');
});
test('apple: a track link inside an album keeps only a numeric ?i= and drops every other parameter', () => {
  assert.equal(ok('https://music.apple.com/us/album/folklore/1528112358?i=1528112363&uo=4&at=evil').embedUrl, 'https://embed.music.apple.com/us/album/folklore/1528112358?i=1528112363');
  assert.equal(ok('https://music.apple.com/us/album/folklore/1528112358?i=abc').embedUrl, 'https://embed.music.apple.com/us/album/folklore/1528112358');
});
test('apple: rejects other hosts, lookalikes, non-https, bad types, and malformed ids with a specific message', () => {
  assert.match(bad(''), /Paste/);
  assert.match(bad('not a url'), /link/);
  assert.match(bad('http://music.apple.com/us/album/x/1528112358'), /https/);
  for (const h of ['https://evil.com/us/album/x/1528112358', 'https://music.apple.com.evil.com/us/album/x/1528112358', 'https://xmusic.apple.com/us/album/x/1528112358', 'https://music.apple.com@evil.com/us/album/x/1528112358', 'https://apple.com/us/album/x/1528112358']) assert.match(bad(h), /music\.apple\.com/);
  assert.match(bad('https://music.apple.com/us/artist/taylor-swift/159260351'), /artist/);
  assert.equal(ok('https://music.apple.com/us/song/x/1528112363').kind, 'song');          // single tracks are supported
  assert.match(bad('https://music.apple.com/us/station/x/ra.123'), /station/);
  assert.match(bad('https://music.apple.com/us/album/x/notanumber'), /unrecognized ID/);
  assert.match(bad('https://music.apple.com/us/playlist/x/12345'), /unrecognized ID/);
  assert.match(bad('https://music.apple.com/usa/album/x/1528112358'), /country/);
  assert.match(bad('https://music.apple.com/us/album'), /incomplete/);
  assert.match(bad('javascript:alert(1)'), /https|link/);
  assert.match(bad('https://music.apple.com/us/album/<script>/1528112358'), /unsupported characters|unrecognized/);
});
test('apple: output is rebuilt from validated parts only (no pass-through of the pasted string)', () => {
  const r = ok('https://music.apple.com/us/album/x/1528112358?foo=bar#frag');
  assert.ok(!r.embedUrl.includes('foo') && !r.embedUrl.includes('frag') && r.embedUrl.startsWith('https://embed.music.apple.com/'));
  assert.ok(r.openUrl.startsWith('https://music.apple.com/'));
});
test('window clamping keeps the title bar reachable and respects min sizes', () => {
  assert.deepEqual(clampBox({ x: -50, y: -9, w: 340, h: 200 }, 1000, 800), { x: 0, y: 0, w: 340, h: 200 });
  const far = clampBox({ x: 5000, y: 5000, w: 340, h: 200 }, 1000, 800);
  assert.deepEqual([far.x, far.y], [660, 768]);                      // y leaves the 32px title bar visible
  assert.equal(clampBox({ x: 0, y: 0, w: 10, h: 10 }, 1000, 800).w, 280);
  const tiny = clampBox({ x: 0, y: 0, w: 600, h: 600 }, 320, 500);   // small phone: shrinks to fit
  assert.ok(tiny.w <= 320 && tiny.x === 0);
});

test('mail: filenames cannot escape the download folder or carry control characters', () => {
  assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('C:\\Users\\me\\evil.exe'), 'evil.exe');
  assert.equal(sanitizeFilename('..hidden'), 'hidden');
  assert.equal(sanitizeFilename('a\u0000b\u0007c<>:|?*.pdf'), 'abc.pdf');
  assert.equal(sanitizeFilename('   '), 'attachment');
  assert.equal(sanitizeFilename('///'), 'attachment');
  assert.ok(sanitizeFilename('x'.repeat(500)).length <= 120);
});
test('mail: base64url decodes to a generic, non-renderable blob of the right size', async () => {
  const b = base64UrlToBlob('AQID_-8');
  assert.equal(b.type, 'application/octet-stream');
  assert.deepEqual([...new Uint8Array(await b.arrayBuffer())], [1, 2, 3, 255, 239]);
});
test('mail: merging pages never duplicates and preserves order', () => {
  assert.deepEqual(mergeUnique([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }, { id: 'c' }]).map((m) => m.id), ['a', 'b', 'c']);
});
test('mail: reply helpers', () => {
  assert.equal(replySubject('Hi'), 'Re: Hi'); assert.equal(replySubject('Re: Hi'), 'Re: Hi'); assert.equal(replySubject('RE: Hi'), 'RE: Hi');
  assert.equal(senderAddress('Bob <bob@x.com>'), 'bob@x.com'); assert.equal(senderAddress('bob@x.com'), 'bob@x.com'); assert.equal(senderAddress('No Address'), '');
  assert.equal(senderName('"Bob B" <bob@x.com>'), 'Bob B');
  assert.match(quoteForReply('Bob <b@x.com>', 'Mon', 'a\nb'), /On Mon, Bob wrote:\n> a\n> b$/);
  assert.equal(formatBytes(512), '512 B'); assert.equal(formatBytes(2048), '2 KB'); assert.equal(formatBytes(5 * 1048576), '5.0 MB');
});
test('mail: folder list is exactly the seven required, and ids are validated', () => {
  assert.deepEqual(FOLDERS.map((f) => f.label), ['Inbox', 'All Mail', 'Sent', 'Drafts', 'Starred', 'Spam', 'Trash']);
  assert.ok(isFolderId('inbox')); assert.ok(!isFolderId('INBOX')); assert.ok(!isFolderId(undefined));
});
test('apple: percent-encoded Unicode slugs from real links are allowed; encoded markup/quotes are not', () => {
  assert.ok(ok('https://music.apple.com/jp/album/%E3%83%86%E3%82%B9%E3%83%88/1528112358').embedUrl.includes('%E3%83%86'));
  for (const slug of ['%3Cscript%3E', '%22onload%3D', '%27x', '%5Cx', '%00x', '%E0%A4%A']) assert.match(bad(`https://music.apple.com/us/album/${slug}/1528112358`), /unsupported characters/);
});


const SP = '37i9dQZF1DXcBWIGoYBM5M';
test('music links: provider is identified and the official embed URL is rebuilt from validated parts', () => {
  const a = parseMusicLink('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb');
  assert.ok(a.ok && a.provider === 'apple' && a.kind === 'playlist' && a.embedUrl.startsWith('https://embed.music.apple.com/'));
  const t = parseMusicLink('https://music.apple.com/us/song/x/1528112363'); assert.ok(t.ok && t.kind === 'track');
  for (const u of [`https://open.spotify.com/playlist/${SP}`, `https://open.spotify.com/intl-in/playlist/${SP}?si=abc&utm=x`, `spotify:playlist:${SP}`, `https://open.spotify.com/embed/playlist/${SP}`]) {
    const r = parseMusicLink(u);
    assert.ok(r.ok && r.provider === 'spotify' && r.kind === 'playlist', u);
    assert.equal((r as any).embedUrl, `https://open.spotify.com/embed/playlist/${SP}`);
    assert.ok(!(r as any).embedUrl.includes('si=') && !(r as any).openUrl.includes('utm'));
  }
  const album = parseMusicLink(`https://open.spotify.com/album/${SP}`); assert.ok(album.ok && album.kind === 'album');
  const track = parseMusicLink(`https://open.spotify.com/track/${SP}`); assert.ok(track.ok && track.kind === 'track');
});
test('music links: unsupported or hostile input is refused with a specific explanation', () => {
  const err = (u: string) => { const r = parseMusicLink(u); assert.equal(r.ok, false, u); return (r as { error: string }).error; };
  assert.match(err(''), /Paste/);
  assert.match(err('not a url'), /link/);
  assert.match(err('https://www.youtube.com/playlist?list=PLabc'), /aren’t supported/);
  assert.match(err('https://soundcloud.com/a/sets/b'), /aren’t supported/);
  assert.match(err('https://example.com/playlist/abc'), /Apple Music .* Spotify/);
  assert.match(err('http://open.spotify.com/playlist/' + SP), /https/);
  assert.match(err('https://open.spotify.com.evil.com/playlist/' + SP), /Apple Music .* Spotify|open\.spotify\.com/);
  assert.match(err('https://spotify.link/abc123'), /Short Spotify links/);
  assert.match(err(`https://open.spotify.com/artist/${SP}`), /artist links can’t be played/);
  assert.match(err(`https://open.spotify.com/show/${SP}`), /show links/);
  assert.match(err('https://open.spotify.com/playlist/short'), /unrecognized ID/);
  assert.match(err(`https://open.spotify.com/playlist/${SP}<script>`), /unrecognized ID/);
  assert.match(err('spotify:playlist:bad id'), /link|Apple|Spotify/);
  assert.match(err('javascript:alert(1)'), /https|link|Apple/);
});

const mk = (n: string, over: Partial<PlaylistItem> = {}): PlaylistItem => ({ id: n, name: n, provider: 'spotify', kind: 'playlist', openUrl: `https://open.spotify.com/playlist/${n}`, embedUrl: '', enabled: true, ...over });
test('playlist library: add validates, names default sensibly, duplicates and the cap are enforced', () => {
  let lib: PlaylistItem[] = [];
  const bad = addPlaylist(lib, 'https://youtube.com/x', '', 'id1'); assert.equal(bad.ok, false);
  const r = addPlaylist(lib, `https://open.spotify.com/playlist/${SP}`, '  Focus\u0007  ', 'id1'); assert.ok(r.ok); lib = (r as any).lib;
  assert.equal(lib[0].name, 'Focus'); assert.equal(lib[0].enabled, true);
  const dup = addPlaylist(lib, `https://open.spotify.com/intl-in/playlist/${SP}?si=zz`, 'Again', 'id2');
  assert.equal(dup.ok, false); assert.match((dup as any).error, /Already in your list as “Focus”/);
  const unnamed = addPlaylist(lib, 'https://music.apple.com/gb/album/folklore/1528112358', '', 'id3'); assert.ok(unnamed.ok); assert.equal((unnamed as any).item.name, 'Apple Music album');
  const full = Array.from({ length: MAX_PLAYLISTS }, (_, i) => mk(`p${i}`));
  assert.match((addPlaylist(full, `https://open.spotify.com/playlist/${SP}`, '', 'x') as any).error, /up to 50/);
});
test('playlist library: rename, enable/disable, reorder and remove behave and never mutate the input', () => {
  const lib = [mk('a'), mk('b'), mk('c')]; const copy = JSON.stringify(lib);
  assert.deepEqual(movePlaylist(lib, 'c', -1).map((p) => p.id), ['a', 'c', 'b']);
  assert.deepEqual(movePlaylist(lib, 'a', -1).map((p) => p.id), ['a', 'b', 'c']);          // already first
  assert.deepEqual(movePlaylist(lib, 'c', 1).map((p) => p.id), ['a', 'b', 'c']);           // already last
  assert.deepEqual(movePlaylist(lib, 'zzz', 1), lib);
  assert.equal(renamePlaylist(lib, 'b', ' New ')[1].name, 'New');
  assert.equal(renamePlaylist(lib, 'b', '   ')[1].name, 'b');                               // blank rename ignored
  assert.equal(togglePlaylist(lib, 'a')[0].enabled, false);
  assert.deepEqual(removePlaylist(lib, 'b').map((p) => p.id), ['a', 'c']);
  assert.equal(JSON.stringify(lib), copy);
});
test('only ENABLED playlists are playable; the active one falls back sensibly; the old single-link setting is migrated', () => {
  const lib = [mk('a', { enabled: false }), mk('b'), mk('c')];
  assert.deepEqual(enabledPlaylists(lib).map((p) => p.id), ['b', 'c']);
  assert.equal(activeFrom({ playlists: lib, activePlaylistId: 'c' })!.id, 'c');
  assert.equal(activeFrom({ playlists: lib, activePlaylistId: 'a' })!.id, 'b');            // disabled -> first enabled
  assert.equal(activeFrom({ playlists: lib })!.id, 'b');
  assert.equal(activeFrom({ playlists: [mk('a', { enabled: false })] }), null);            // nothing enabled -> nothing shown
  assert.equal(activeFrom({}), null);                                                      // nothing is auto-discovered
  const migrated = libraryFrom({ appleMusic: { url: 'https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb' } });
  assert.equal(migrated.length, 1); assert.equal(migrated[0].enabled, true); assert.equal(migrated[0].provider, 'apple');
  assert.deepEqual(libraryFrom({ playlists: [], appleMusic: { url: 'https://music.apple.com/us/album/x/1528112358' } }), []);   // an explicit empty list wins over legacy
});
