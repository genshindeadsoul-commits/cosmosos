import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppleMusicUrl, clampBox } from '../src/lib/appleEmbed.ts';
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
  assert.match(bad('https://music.apple.com/us/song/x/1528112363'), /song/);
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
