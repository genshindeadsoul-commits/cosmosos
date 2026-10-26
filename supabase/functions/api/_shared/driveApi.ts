import { type Ctx, HttpError } from './ports.ts';
import { getAccessToken, providerRequest } from './tokens.ts';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_NAME = 'Cosmos OS Backups';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const FILE_ID = /^[A-Za-z0-9_-]{10,100}$/;
const FORMAT_MAX = 3;

const bytes = (s: string) => new TextEncoder().encode(s).length;
const stamp = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z').replace('T', '_').replace(/:/g, '-');   // 2026-10-23_09-30-00Z

/** Cheap structural check so we never upload (or hand back) something that isn't a Cosmos OS backup. */
export function checkBackupEnvelope(content: unknown): { records: number; formatVersion: number } {
  if (typeof content !== 'string' || !content) throw new HttpError(400, 'invalid_backup', 'Nothing to back up.');
  if (bytes(content) > MAX_BACKUP_BYTES) throw new HttpError(413, 'too_large', 'This backup is larger than 10 MB, which is the limit for Drive backups.');
  let j: any;
  try { j = JSON.parse(content); } catch { throw new HttpError(400, 'invalid_backup', 'The backup is not valid JSON.'); }
  if (j?.app !== 'cosmos-os' || !Number.isInteger(j.formatVersion) || j.formatVersion < 1 || j.formatVersion > FORMAT_MAX || typeof j.data !== 'object' || !j.data) {
    throw new HttpError(400, 'invalid_backup', 'This does not look like a Cosmos OS backup.');
  }
  const records = Object.values(j.data).reduce((n: number, v) => n + (Array.isArray(v) ? v.length : 0), 0) as number;
  return { records, formatVersion: j.formatVersion };
}

export async function driveAction(userId: string, body: any, ctx: Ctx) {
  const { accessToken } = await getAccessToken(userId, 'google_drive', ctx);
  const req = (url: string, init?: Parameters<typeof providerRequest>[5]) => providerRequest(userId, 'google_drive', url, accessToken, ctx, init);
  const json = async (url: string, init?: Parameters<typeof providerRequest>[5]) => (await req(url, init)).json();

  const findFolder = async (): Promise<string | null> => {
    const q = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
    const r = await json(`${DRIVE}/files?${new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1' })}`);
    return r.files?.[0]?.id ?? null;
  };
  const ensureFolder = async (): Promise<string> =>
    (await findFolder()) ?? (await json(`${DRIVE}/files?fields=id`, { method: 'POST', json: { name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' } })).id;

  switch (body?.action) {
    case 'create': {
      const { records, formatVersion } = checkBackupEnvelope(body.content);
      const content = body.content as string;
      try {
        const folderId = await ensureFolder();
        // A brand-new, uniquely named file every time. Older backups are never touched or overwritten.
        const name = `cosmos-os-backup-${stamp(ctx.now())}.json`;
        const boundary = `cosmos${crypto.randomUUID().replace(/-/g, '')}`;
        const meta = { name, parents: [folderId], mimeType: 'application/json', appProperties: { cosmosBackup: '1', formatVersion: String(formatVersion), records: String(records) } };
        const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
        const created = await json(`${UPLOAD}/files?uploadType=multipart&fields=id,name,size,createdTime`, { method: 'POST', body: multipart, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } });
        // Verify by reading it back. If it differs at all, remove the new file and fail; the previous backups remain valid.
        const back = await (await req(`${DRIVE}/files/${created.id}?alt=media`)).text();
        if (back !== content) {
          await req(`${DRIVE}/files/${created.id}`, { method: 'DELETE' }).catch(() => {});
          throw new HttpError(502, 'backup_verify_failed', 'Drive stored an incomplete copy, so it was discarded. Your previous backups and your data are untouched. Try again.');
        }
        await ctx.db.saveConnection(userId, 'google_drive', { last_synced_at: ctx.now().toISOString(), last_error: null });
        return { id: created.id, name: created.name, size: Number(created.size ?? bytes(content)), createdTime: created.createdTime, records };
      } catch (e) {
        if (!(e instanceof HttpError && e.code === 'needs_reauthorization')) {
          await ctx.db.saveConnection(userId, 'google_drive', { last_error: `Last backup attempt failed: ${(e as Error).message}`.slice(0, 300) }).catch(() => {});
        }
        throw e;
      }
    }
    case 'list': {
      const folderId = await findFolder();
      if (!folderId) return { backups: [] };
      const q = `'${folderId}' in parents and trashed=false and appProperties has { key='cosmosBackup' and value='1' }`;
      const r = await json(`${DRIVE}/files?${new URLSearchParams({ q, orderBy: 'createdTime desc', pageSize: '25', fields: 'files(id,name,size,createdTime,appProperties)' })}`);
      return { backups: (r.files ?? []).map((f: any) => ({ id: f.id, name: f.name, size: Number(f.size ?? 0), createdTime: f.createdTime, records: Number(f.appProperties?.records ?? 0), formatVersion: Number(f.appProperties?.formatVersion ?? 0) })) };
    }
    case 'get': {
      if (typeof body.id !== 'string' || !FILE_ID.test(body.id)) throw new HttpError(400, 'bad_id');
      const folderId = await findFolder();
      const meta = await json(`${DRIVE}/files/${body.id}?fields=id,name,size,parents,trashed,appProperties`);
      // Only files that are Cosmos OS backups inside the Cosmos OS folder can be read through this route.
      if (!folderId || meta.trashed || !(meta.parents ?? []).includes(folderId) || meta.appProperties?.cosmosBackup !== '1') throw new HttpError(404, 'not_a_backup', 'That file is not a Cosmos OS backup.');
      if (Number(meta.size ?? 0) > MAX_BACKUP_BYTES) throw new HttpError(413, 'too_large', 'That backup is larger than 10 MB.');
      const content = await (await req(`${DRIVE}/files/${body.id}?alt=media`)).text();
      return { id: meta.id, name: meta.name, content };
    }
    default:
      throw new HttpError(400, 'bad_action');
  }
}
