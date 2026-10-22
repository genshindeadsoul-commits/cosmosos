import { extractBody, headerMap, rawHeader } from './parse.ts';
import { GMAIL_SCOPE } from './providers.ts';
import { type Ctx, HttpError } from './ports.ts';
import { getAccessToken, providerFetch } from './tokens.ts';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const ID = /^[0-9a-f]{8,32}$/i;
const ATT_ID = /^[A-Za-z0-9_-]{10,2000}$/;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Real Gmail labels. "all" has no label filter (All Mail = everything except Spam and Trash). */
export const FOLDERS: Record<string, { labelIds?: string[]; includeSpamTrash?: boolean }> = {
  inbox: { labelIds: ['INBOX'] },
  all: {},
  sent: { labelIds: ['SENT'] },
  drafts: { labelIds: ['DRAFT'] },
  starred: { labelIds: ['STARRED'] },
  spam: { labelIds: ['SPAM'], includeSpamTrash: true },    // Gmail hides these unless asked
  trash: { labelIds: ['TRASH'], includeSpamTrash: true },
};
const MODIFIABLE_LABELS = new Set(['UNREAD', 'STARRED']);   // mark read/unread, star/unstar: nothing else

async function requireScope(userId: string, scope: string, capability: 'modify' | 'send', ctx: Ctx) {
  const conn = await ctx.db.getConnection(userId, 'gmail');
  if (!conn?.granted_scopes.includes(scope)) {
    throw new HttpError(403, 'scope_not_granted', capability === 'modify'
      ? 'Changing messages needs extra Gmail permission. Enable it in Mail settings.'
      : 'Sending needs extra Gmail permission. Enable it in Mail settings.');
  }
}

// ---------- MIME building (plain text only) ----------
const EMAIL = /^[^\s@<>(),;:"\\[\]]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const noCtl = (s: string) => !/[\r\n\u0000]/.test(s);
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64url = (s: string) => b64(new TextEncoder().encode(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n');

export function parseRecipients(v: unknown, field: string, required: boolean): string[] {
  const list = (Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? v.split(/[,;]/) : []).map((x) => String(x).trim()).filter(Boolean);
  if (required && list.length === 0) throw new HttpError(400, 'invalid_message', `${field}: add at least one recipient.`);
  if (list.length > 20) throw new HttpError(400, 'invalid_message', `${field}: at most 20 recipients.`);
  for (const a of list) if (a.length > 254 || !noCtl(a) || !EMAIL.test(a)) throw new HttpError(400, 'invalid_message', `${field}: “${a.slice(0, 60)}” isn’t a valid email address.`);
  return list;
}

export function buildRawMessage(m: { to: string[]; cc: string[]; subject: string; body: string; inReplyTo?: string; references?: string }): string {
  const encSubject = /^[\x20-\x7e]*$/.test(m.subject) ? m.subject : `=?UTF-8?B?${b64(new TextEncoder().encode(m.subject))}?=`;
  const lines = [`To: ${m.to.join(', ')}`, ...(m.cc.length ? [`Cc: ${m.cc.join(', ')}`] : []), `Subject: ${encSubject}`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64'];
  if (m.inReplyTo) lines.push(`In-Reply-To: ${m.inReplyTo}`);
  if (m.references) lines.push(`References: ${m.references}`);
  return b64url(`${lines.join('\r\n')}\r\n\r\n${wrap76(b64(new TextEncoder().encode(m.body.replace(/\r?\n/g, '\r\n'))))}`);
}

const MSGID = /^<[^<>\s]{1,300}>$/;

export async function gmailAction(userId: string, body: any, ctx: Ctx) {
  const { accessToken } = await getAccessToken(userId, 'gmail', ctx);
  const call = (path: string, init?: { method?: string; json?: unknown }) => providerFetch(userId, 'gmail', `${GMAIL}${path}`, accessToken, ctx, init);

  switch (body?.action) {
    case 'list': {
      const folder = FOLDERS[body.folder ?? 'all'];
      if (!folder || !Object.prototype.hasOwnProperty.call(FOLDERS, body.folder ?? 'all')) throw new HttpError(400, 'bad_folder');
      const params = new URLSearchParams({ maxResults: '25' });
      for (const l of folder.labelIds ?? []) params.append('labelIds', l);
      if (folder.includeSpamTrash) params.set('includeSpamTrash', 'true');
      const q = typeof body.q === 'string' ? body.q.slice(0, 300) : '';
      if (q) params.set('q', q);
      if (typeof body.pageToken === 'string' && body.pageToken.length < 500) params.set('pageToken', body.pageToken);
      const list = await call(`/messages?${params}`);
      const ids: string[] = [...new Set<string>((list.messages ?? []).map((m: any) => m.id))];   // never render a message twice
      const metas = await Promise.all(ids.map((id) => call(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));
      await ctx.db.saveConnection(userId, 'gmail', { last_synced_at: ctx.now().toISOString(), last_error: null });
      return {
        messages: metas.map((m: any) => ({ id: m.id, threadId: m.threadId, ...headerMap(m.payload?.headers), snippet: m.snippet ?? '',
          unread: (m.labelIds ?? []).includes('UNREAD'), starred: (m.labelIds ?? []).includes('STARRED'), internalDate: m.internalDate ? Number(m.internalDate) : null })),
        nextPageToken: list.nextPageToken ?? null, estimate: list.resultSizeEstimate ?? 0,
      };
    }
    case 'get': {
      if (typeof body.id !== 'string' || !ID.test(body.id)) throw new HttpError(400, 'bad_id');
      const m = await call(`/messages/${body.id}?format=full`);
      const h = m.payload?.headers ?? [];
      const { text, attachments } = extractBody(m.payload);
      return { id: m.id, threadId: m.threadId, ...headerMap(h), to: rawHeader(h, 'to'), cc: rawHeader(h, 'cc'), replyTo: rawHeader(h, 'reply-to'),
        messageId: rawHeader(h, 'message-id'), references: rawHeader(h, 'references'),
        unread: (m.labelIds ?? []).includes('UNREAD'), starred: (m.labelIds ?? []).includes('STARRED'),
        bodyText: text, attachments, webLink: `https://mail.google.com/mail/u/0/#all/${m.id}` };
    }
    case 'attachment': {
      if (typeof body.id !== 'string' || !ID.test(body.id) || typeof body.attachmentId !== 'string' || !ATT_ID.test(body.attachmentId)) throw new HttpError(400, 'bad_id');
      const a = await call(`/messages/${body.id}/attachments/${body.attachmentId}`);
      if ((a.size ?? 0) > MAX_ATTACHMENT_BYTES) throw new HttpError(413, 'too_large', 'That attachment is over 15 MB. Open it in Gmail to download.');
      return { size: a.size ?? 0, data: a.data ?? '' };               // base64url, decoded by the client into a Blob
    }
    case 'modify': {
      if (typeof body.id !== 'string' || !ID.test(body.id)) throw new HttpError(400, 'bad_id');
      const add: string[] = Array.isArray(body.addLabelIds) ? body.addLabelIds : [], remove: string[] = Array.isArray(body.removeLabelIds) ? body.removeLabelIds : [];
      if (add.length + remove.length === 0 || [...add, ...remove].some((l) => !MODIFIABLE_LABELS.has(l))) throw new HttpError(400, 'bad_labels', 'Only read/unread and starred can be changed.');
      await requireScope(userId, GMAIL_SCOPE.modify, 'modify', ctx);
      const r = await call(`/messages/${body.id}/modify`, { method: 'POST', json: { addLabelIds: add, removeLabelIds: remove } });
      return { id: r.id, unread: (r.labelIds ?? []).includes('UNREAD'), starred: (r.labelIds ?? []).includes('STARRED') };
    }
    case 'send': {
      await requireScope(userId, GMAIL_SCOPE.send, 'send', ctx);
      const to = parseRecipients(body.to, 'To', true), cc = parseRecipients(body.cc, 'Cc', false);
      const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
      if (!subject || subject.length > 200 || !noCtl(subject)) throw new HttpError(400, 'invalid_message', 'Subject is required (max 200 characters, one line).');
      const text = typeof body.body === 'string' ? body.body : '';
      if (!text.trim() || text.length > 100_000) throw new HttpError(400, 'invalid_message', 'Message body is required (max 100,000 characters).');
      const inReplyTo = typeof body.inReplyTo === 'string' && MSGID.test(body.inReplyTo) ? body.inReplyTo : undefined;
      const references = typeof body.references === 'string' && body.references.split(/\s+/).filter(Boolean).every((x: string) => MSGID.test(x)) ? body.references.trim() || undefined : undefined;
      const threadId = typeof body.threadId === 'string' && ID.test(body.threadId) ? body.threadId : undefined;
      const sent = await call('/messages/send', { method: 'POST', json: { raw: buildRawMessage({ to, cc, subject, body: text, inReplyTo, references }), ...(threadId ? { threadId } : {}) } });
      return { id: sent.id, threadId: sent.threadId };
    }
    default:
      throw new HttpError(400, 'bad_action');
  }
}
