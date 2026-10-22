import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Mail, PenSquare, Reply, Search, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { usePrefs } from '../../context/PrefsContext';
import type { GmailMessageFull, GmailMessageSummary } from '../../lib/integrationsApi';
import { base64UrlToBlob, FOLDERS, FolderId, formatBytes, formatMailDate, GMAIL_SCOPES, isFolderId, mergeUnique, quoteForReply, replySubject, sanitizeFilename, senderAddress, senderName } from '../../lib/mail';

const field = 'w-full rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:ring-1 focus:ring-[#526B55]';
const btn = 'rounded bg-[#3D5240] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50';
const ghost = 'rounded border border-[#DFE1D9] dark:border-[#383D35] px-2.5 py-1.5 text-xs font-semibold hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] disabled:opacity-50';

interface Draft { to: string; cc: string; subject: string; body: string; threadId?: string; inReplyTo?: string; references?: string }

/**
 * Mail is fetched on demand from the Gmail API through the server function and kept in component memory only.
 * Nothing is written to localStorage or to the database, and the whole tree unmounts on sign-out/account switch.
 */
export const MailView: React.FC = () => {
  const { showToast } = useApp();
  const { isConnected, gmailScopes, connectGmail, gmailList, gmailGet, gmailAttachment, gmailModify, gmailSend, busy, integrations } = useIntegrations();
  const { prefs, update } = usePrefs();
  const connected = isConnected('gmail');
  const canModify = gmailScopes.includes(GMAIL_SCOPES.modify);
  const canSend = gmailScopes.includes(GMAIL_SCOPES.send);
  const statusItem = integrations.find((i) => i.id === 'gmail');

  const [folder, setFolder] = useState<FolderId>(isFolderId(prefs.mailFolder) ? prefs.mailFolder : 'inbox');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GmailMessageFull | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, setSending] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async (f: FolderId, q: string, pageToken?: string) => {
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const r = await gmailList(f, q, pageToken);
      if (id !== reqId.current) return;                       // a newer request superseded this one
      setMessages((prev) => (pageToken ? mergeUnique(prev, r.messages) : mergeUnique([], r.messages)));
      setNext(r.nextPageToken);
    } catch (e) { if (id === reqId.current) setError((e as Error).message); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [gmailList]);

  useEffect(() => { if (connected) { setOpen(null); void load(folder, activeQuery); } }, [connected, folder, activeQuery]);

  const pickFolder = (f: FolderId) => { setFolder(f); setQuery(''); setActiveQuery(''); setOpen(null); setDraft(null); update({ mailFolder: f }); };
  const patchMessage = (id: string, patch: Partial<GmailMessageSummary>) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const read = async (m: GmailMessageSummary) => {
    setOpening(m.id); setError(null); setDraft(null);
    try {
      const full = await gmailGet(m.id);
      setOpen(full);
      if (canModify && full.unread) {                         // opening marks read, only if the user authorized changes
        gmailModify(m.id, [], ['UNREAD']).then(() => { patchMessage(m.id, { unread: false }); setOpen((o) => (o && o.id === m.id ? { ...o, unread: false } : o)); }).catch(() => {});
      }
    } catch (e) { setError((e as Error).message); } finally { setOpening(null); }
  };

  const toggle = async (what: 'UNREAD' | 'STARRED') => {
    if (!open) return;
    if (!canModify) { showToast('Enable “Mark read / star” first.', 'warning'); return; }
    setWorking(true);
    try {
      const has = what === 'UNREAD' ? open.unread : open.starred;
      const r = await gmailModify(open.id, has ? [] : [what], has ? [what] : []);
      setOpen({ ...open, unread: r.unread, starred: r.starred });
      patchMessage(open.id, { unread: r.unread, starred: r.starred });
      if (folder === 'starred' && !r.starred) setMessages((m) => m.filter((x) => x.id !== open.id));
    } catch (e) { showToast((e as Error).message, 'error'); } finally { setWorking(false); }
  };

  const download = async (a: GmailMessageFull['attachments'][number]) => {
    if (!open) return;
    setWorking(true);
    try {
      const { data } = await gmailAttachment(open.id, a.attachmentId);
      const url = URL.createObjectURL(base64UrlToBlob(data));
      const link = document.createElement('a');
      link.href = url; link.download = sanitizeFilename(a.filename); link.rel = 'noopener';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { showToast((e as Error).message, 'error'); } finally { setWorking(false); }
  };

  const startCompose = (d: Draft) => { if (!canSend) { showToast('Enable “Send email” first.', 'warning'); return; } setDraftError(null); setDraft(d); };
  const startReply = () => {
    if (!open) return;
    const to = senderAddress(open.replyTo || open.from);
    startCompose({ to, cc: '', subject: replySubject(open.subject), body: quoteForReply(open.from, open.date, open.bodyText), threadId: open.threadId, inReplyTo: open.messageId || undefined, references: [open.references, open.messageId].filter(Boolean).join(' ') || undefined });
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSending(true); setDraftError(null);
    try {
      await gmailSend({ to: draft.to, cc: draft.cc || undefined, subject: draft.subject, body: draft.body, threadId: draft.threadId, inReplyTo: draft.inReplyTo, references: draft.references });
      showToast('Email sent.', 'success'); setDraft(null);
      if (folder === 'sent') void load('sent', activeQuery);
    } catch (err) { setDraftError((err as Error).message); } finally { setSending(false); }
  };

  // ---------------- not connected ----------------
  if (!connected) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Mail className="h-4 w-4" /> Mail</div>
        <p className="text-sm font-semibold">{statusItem?.status === 'needs_reauthorization' ? 'Reconnect Gmail' : 'Gmail isn’t connected'}</p>
        <p className="mt-1 text-xs text-[#6B7067] dark:text-[#A6AB9F]">
          Connecting asks Google for <strong>read-only</strong> access to your mailbox. Changing messages and sending are separate permissions you can add later. Signing in to Cosmos OS doesn’t grant any mailbox access.
        </p>
        {statusItem?.description?.includes('Last error') && <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-400">{statusItem.description.split('Last error:')[1]}</p>}
        <button onClick={() => void connectGmail()} disabled={busy === 'gmail'} className={`${btn} mt-4`}>{busy === 'gmail' ? 'Opening Google…' : 'Connect Gmail'}</button>
      </div>
    );
  }

  const showReading = open || draft;
  const permissions = (
    <div className="space-y-1 text-[11px]">
      <p className="font-semibold text-[#6B7067] dark:text-[#A6AB9F]">Permissions</p>
      <p>Read: on</p>
      {canModify ? <p>Mark read / star: on</p> : <button className="block text-left underline" onClick={() => void connectGmail(canSend ? ['modify', 'send'] : ['modify'])}>Enable mark read / star</button>}
      {canSend ? <p>Send email: on</p> : <button className="block text-left underline" onClick={() => void connectGmail(canModify ? ['modify', 'send'] : ['send'])}>Enable send email</button>}
    </div>
  );
  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[420px] overflow-hidden rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6]">
      {/* Folders */}
      <nav aria-label="Mail folders" className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-[#DFE1D9] dark:border-[#383D35] p-2 md:flex">
        <button onClick={() => startCompose({ to: '', cc: '', subject: '', body: '' })} className={`${btn} mb-2 flex items-center justify-center gap-1.5`}><PenSquare className="h-3.5 w-3.5" /> Compose</button>
        {FOLDERS.map((f) => (
          <button key={f.id} onClick={() => pickFolder(f.id)} aria-current={folder === f.id ? 'page' : undefined}
            className={`rounded px-2.5 py-1.5 text-left text-xs ${folder === f.id ? 'bg-[#ECEDE7] dark:bg-[#292D27] font-bold' : 'hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]'}`}>{f.label}</button>
        ))}
        <div className="mt-auto border-t border-[#DFE1D9] dark:border-[#383D35] pt-2">{permissions}</div>
      </nav>

      {/* List */}
      <section aria-label="Messages" className={`${showReading ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 flex-col border-r border-[#DFE1D9] dark:border-[#383D35] lg:max-w-sm`}>
        <div className="flex items-center gap-2 border-b border-[#DFE1D9] dark:border-[#383D35] p-2 md:hidden">
          <select aria-label="Folder" value={folder} onChange={(e) => pickFolder(e.target.value as FolderId)} className={`${field} flex-1`}>
            {FOLDERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <button onClick={() => startCompose({ to: '', cc: '', subject: '', body: '' })} className={btn} aria-label="Compose">Compose</button>
        </div>
        <details className="border-b border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 md:hidden"><summary className="cursor-pointer text-[11px] font-semibold">Permissions</summary><div className="pt-1">{permissions}</div></details>
        <form onSubmit={(e) => { e.preventDefault(); setActiveQuery(query.trim()); }} className="flex gap-1.5 border-b border-[#DFE1D9] dark:border-[#383D35] p-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-[#8A8E85]" />
            <input aria-label="Search mail" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${FOLDERS.find((f) => f.id === folder)!.label}`} className={`${field} pl-7`} />
          </div>
          <button className={btn}>Search</button>
        </form>
        <div className="flex-1 overflow-y-auto">
          {error && <div role="alert" className="m-2 rounded border border-rose-300 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-2 text-xs text-rose-800 dark:text-rose-300">{error} <button className="ml-1 underline" onClick={() => void load(folder, activeQuery)}>Retry</button></div>}
          {!loading && !error && messages.length === 0 && <p className="p-6 text-center text-xs text-[#8A8E85]">{activeQuery ? 'No messages match.' : 'This folder is empty.'}</p>}
          <ul>
            {messages.map((m) => (
              <li key={m.id}>
                <button onClick={() => void read(m)} disabled={opening === m.id} aria-current={open?.id === m.id ? 'true' : undefined}
                  className={`block w-full border-b border-[#ECEDE7] dark:border-[#2A2E28] px-3 py-2 text-left hover:bg-[#F5F5F0] dark:hover:bg-[#292D27] ${open?.id === m.id ? 'bg-[#F5F5F0] dark:bg-[#292D27]' : ''}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`flex min-w-0 items-center gap-1 truncate text-xs ${m.unread ? 'font-bold' : ''}`}>
                      {m.unread && <span aria-label="Unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#526B55]" />}
                      <span className="truncate">{senderName(m.from)}</span>
                      {m.starred && <Star aria-label="Starred" className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#8A8E85]">{formatMailDate(m.internalDate, m.date)}</span>
                  </div>
                  <div className={`truncate text-xs ${m.unread ? 'font-semibold' : ''}`}>{m.subject}</div>
                  <div className="truncate text-[11px] text-[#8A8E85]">{opening === m.id ? 'Opening…' : m.snippet}</div>
                </button>
              </li>
            ))}
          </ul>
          {loading && <p role="status" className="p-3 text-center text-xs text-[#8A8E85]">Loading…</p>}
          {next && !loading && <div className="p-3 text-center"><button onClick={() => void load(folder, activeQuery, next)} className="text-xs font-semibold underline">Load more</button></div>}
        </div>
      </section>

      {/* Reading / composing */}
      <section aria-label={draft ? 'Compose' : 'Message'} className={`${showReading ? 'flex' : 'hidden lg:flex'} min-w-0 flex-[2] flex-col overflow-y-auto`}>
        {draft ? (
          <form onSubmit={send} className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{draft.threadId ? 'Reply' : 'New message'}</h2><button type="button" className={ghost} onClick={() => setDraft(null)}>Discard</button></div>
            <input aria-label="To" placeholder="To (comma-separated)" className={field} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            <input aria-label="Cc" placeholder="Cc" className={field} value={draft.cc} onChange={(e) => setDraft({ ...draft, cc: e.target.value })} />
            <input aria-label="Subject" placeholder="Subject" maxLength={200} className={field} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            <textarea aria-label="Message" className={`${field} min-h-[200px] flex-1 font-sans`} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            {draftError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{draftError}</p>}
            <div><button className={btn} disabled={sending}>{sending ? 'Sending…' : 'Send'}</button></div>
          </form>
        ) : open ? (
          <div className="space-y-3 p-4">
            <button onClick={() => setOpen(null)} className="flex items-center gap-1 text-xs font-semibold text-[#6B7067] hover:underline lg:hidden"><ArrowLeft className="h-3 w-3" /> Back</button>
            <h2 className="break-words text-sm font-bold">{open.subject}</h2>
            <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">From {open.from}{open.to ? ` · To ${open.to}` : ''}{open.cc ? ` · Cc ${open.cc}` : ''} · {open.date}</p>
            <div className="flex flex-wrap gap-1.5">
              <button className={ghost} onClick={startReply}><Reply className="mr-1 inline h-3 w-3" />Reply</button>
              <button className={ghost} disabled={working} onClick={() => void toggle('STARRED')}><Star className={`mr-1 inline h-3 w-3 ${open.starred ? 'fill-amber-400 text-amber-400' : ''}`} />{open.starred ? 'Unstar' : 'Star'}</button>
              <button className={ghost} disabled={working} onClick={() => void toggle('UNREAD')}>{open.unread ? 'Mark read' : 'Mark unread'}</button>
              <a className={ghost} href={open.webLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 inline h-3 w-3" />Open in Gmail</a>
            </div>
            {(!canModify || !canSend) && <p className="text-[11px] text-[#8A8E85]">{!canModify && 'Star and read/unread need the “mark read / star” permission. '}{!canSend && 'Reply needs the “send email” permission.'}</p>}
            <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">{open.bodyText || '(No text content)'}</pre>
            {open.attachments.length > 0 && (
              <ul aria-label="Attachments" className="space-y-1 border-t border-[#DFE1D9] dark:border-[#383D35] pt-2">
                {open.attachments.map((a) => (
                  <li key={a.attachmentId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate">{a.filename} <span className="text-[#8A8E85]">({formatBytes(a.size)})</span></span>
                    {a.size > 15 * 1024 * 1024
                      ? <a className="underline" href={open.webLink} target="_blank" rel="noopener noreferrer">Too large: open in Gmail</a>
                      : <button className={ghost} disabled={working} onClick={() => void download(a)} aria-label={`Download ${a.filename}`}><Download className="mr-1 inline h-3 w-3" />Download</button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : <p className="m-auto p-6 text-xs text-[#8A8E85]">Select a message to read it.</p>}
      </section>
    </div>
  );
};
