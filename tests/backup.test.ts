import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackupJson, parseBackup, stripSecrets, sanitizeSettings, countRecords, BACKUP_VERSION } from '../src/data/backup.ts';
import { EMPTY_DATA, newId, CosmosAppData } from '../src/data/cloudData.ts';

const nid = newId(), tid = newId(), hid = newId(), tbl = newId();
const sample = (): CosmosAppData => ({
  ...EMPTY_DATA,
  notes: [{ id: nid, title: 'N', content: 'c', excerpt: 'c', starred: false, tags: ['a'], createdAt: '', updatedAt: '' }],
  tasks: [{ id: tid, title: 'T', list: 'Inbox', status: 'todo', priority: 'LOW', dueDate: '2026-10-19', createdAt: '', linkedNoteId: nid }],
  habits: [{ id: hid, name: 'H', category: 'x', streak: 1, checkins: { '2026-10-19': true } }],
  transactions: [{ id: newId(), type: 'expense', category: 'Dining', description: 'Lunch', amount: 12.5, date: '2026-10-19' }],
  tables: [{ id: tbl, name: 'T', description: '', updatedAt: '', columns: [{ id: 'c1', name: 'A', type: 'text' }], rows: [{ id: newId(), c1: 'x' }] }],
});
const SP = '37i9dQZF1DXcBWIGoYBM5M';

test('backup: build -> parse round-trips every list, the version, the date, and the settings', () => {
  const d = sample();
  const json = buildBackupJson(d, { theme: 'dark', mailFolder: 'sent', playlists: [{ id: 'p1', name: 'Focus', provider: 'spotify', kind: 'playlist', openUrl: `https://open.spotify.com/playlist/${SP}`, embedUrl: `https://open.spotify.com/embed/playlist/${SP}`, enabled: true }], activePlaylistId: 'p1' }, new Date('2026-10-23T09:30:00Z'));
  const r = parseBackup(json);
  assert.ok(r.ok); if (!r.ok) return;
  assert.deepEqual(r.data, d);
  assert.equal(r.formatVersion, BACKUP_VERSION); assert.equal(r.legacy, false); assert.equal(r.createdAt, '2026-10-23T09:30:00.000Z');
  assert.equal(r.counts.total, countRecords(d)); assert.equal(r.counts.remapped, 0);
  assert.equal(r.settings.theme, 'dark'); assert.equal(r.settings.mailFolder, 'sent'); assert.equal(r.settings.playlists![0].name, 'Focus'); assert.equal(r.settings.activePlaylistId, 'p1');
});
test('backup: credentials never go in, at any depth, whatever a setting is named', () => {
  const dirty: any = { theme: 'light', accessToken: 'AT', refresh_token: 'RT', nested: { apiKey: 'K', ok: 1, Authorization: 'Bearer x', client_secret: 's', password: 'p', cookie: 'c' }, list: [{ token: 't', keep: 1 }] };
  const clean = stripSecrets(dirty);
  assert.deepEqual(clean, { theme: 'light', nested: { ok: 1 }, list: [{ keep: 1 }] });
  const json = buildBackupJson(sample(), dirty);
  for (const word of ['AT"', 'RT"', 'Bearer', 'client_secret', 'password', 'refresh_token', 'accessToken', 'apiKey']) assert.ok(!json.includes(word), word);
  const keys = new Set<string>(); JSON.stringify(JSON.parse(buildBackupJson(sample())), (k, v) => (keys.add(k), v));
  assert.ok(![...keys].some((k) => /token|secret|password|credential|cookie|authorization/i.test(k)));
});
test('backup: a newer format, a bad version, or a damaged envelope is refused with a reason', () => {
  const ok = JSON.parse(buildBackupJson(sample()));
  const e = (o: any) => { const r = parseBackup(JSON.stringify(o)); assert.equal(r.ok, false); return (r as { error: string }).error; };
  assert.match(e({ ...ok, formatVersion: BACKUP_VERSION + 1 }), /newer version/);
  assert.match(e({ ...ok, formatVersion: 0 }), /invalid version/);
  assert.match(e({ ...ok, formatVersion: 'three' }), /invalid version/);
  assert.match(e({ ...ok, data: undefined }), /no data section/);
  assert.match(e({ ...ok, data: { ...ok.data, notes: 'nope' } }), /"notes" is malformed/);
  assert.match(e({ ...ok, data: { ...ok.data, tasks: [] } }), /incomplete or damaged: "tasks" should have 1 items but has 0/);   // truncation detected
  assert.match(e({ ...ok, data: { ...ok.data, notes: [...ok.data.notes, { id: newId(), title: 'extra', tags: [] }] } }), /"notes" should have 1/);
  assert.equal(parseBackup('{{{').ok, false); assert.equal(parseBackup('[]').ok, false); assert.equal(parseBackup('{"app":"cosmos-os","formatVersion":3,"data":{}}').ok, false);
  assert.equal(parseBackup('x'.repeat(10 * 1024 * 1024 + 1)).ok, false);
});
test('backup: restoring never throws on hostile input, and rejects impossible dates before anything is applied', () => {
  const ok = JSON.parse(buildBackupJson(sample()));
  ok.data.transactions[0].date = '2026-02-31'; ok.counts.transactions = 1;
  const r = parseBackup(JSON.stringify(ok));
  assert.equal(r.ok, false); assert.match((r as any).error, /Nothing was imported/);
  for (const junk of ['null', '123', '"str"', '{"app":"cosmos-os"}', '{"app":"cosmos-os","formatVersion":3,"data":{"notes":[null]}}']) assert.doesNotThrow(() => parseBackup(junk));
});
test('backup: older flat exports (v1/v2) still restore, with legacy ids re-keyed and links kept', () => {
  const r = parseBackup(JSON.stringify({ version: '1.0', notes: [{ id: 'note-1', title: 'a', tags: [] }], tasks: [{ id: 'task-1', title: 't', linkedNoteId: 'note-1', dueDate: '2026-10-19' }] }));
  assert.ok(r.ok); if (!r.ok) return;
  assert.equal(r.legacy, true); assert.equal(r.counts.remapped, 2); assert.equal(r.data.tasks[0].linkedNoteId, r.data.notes[0].id);
  assert.deepEqual(r.settings, {});
});
test('backup settings are re-validated: tampered links, layout numbers, theme, and unknown keys cannot sneak through', () => {
  const s = sanitizeSettings({
    theme: 'neon', mailFolder: '../../x', evil: { a: 1 },
    playlists: [
      { id: 'ok1', name: '  Good\u0007  ', openUrl: `https://open.spotify.com/playlist/${SP}`, embedUrl: 'https://evil.example/steal', enabled: true },
      { id: 'bad', name: 'Bad', openUrl: 'javascript:alert(1)', embedUrl: 'javascript:alert(1)' },
      { id: 'bad2', name: 'Bad2', openUrl: 'https://evil.example/playlist/1' },
      { name: 5, openUrl: 'https://music.apple.com/us/album/x/1528112358' },
    ],
    activePlaylistId: 'ok1',
    appleMusic: { x: -50, y: 1e9, w: 5, h: 99999, mode: 'weird', visible: 'yes' },
  });
  assert.equal(s.theme, undefined); assert.equal(s.mailFolder, undefined); assert.ok(!('evil' in s));
  assert.equal(s.playlists!.length, 2);
  assert.equal(s.playlists![0].name, 'Good'); assert.equal(s.playlists![0].embedUrl, `https://open.spotify.com/embed/playlist/${SP}`);   // rebuilt, not trusted
  assert.ok(s.playlists!.every((p) => /^https:\/\/(open\.spotify\.com|music\.apple\.com)\//.test(p.openUrl) && /^https:\/\/(open\.spotify\.com\/embed|embed\.music\.apple\.com)\//.test(p.embedUrl)));
  assert.equal(s.playlists![1].name, 'Playlist'); assert.ok(s.playlists![1].id.length > 10);
  assert.equal(s.activePlaylistId, 'ok1');
  assert.deepEqual(s.appleMusic, { x: 0, y: 10000, w: 280, h: 640, mode: undefined, visible: undefined });
  assert.deepEqual(sanitizeSettings(null), {}); assert.deepEqual(sanitizeSettings('x'), {});
});
