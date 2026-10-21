import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, ListPlus, Mail, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import type { GmailMessageFull, GmailMessageSummary } from '../../lib/integrationsApi';
import { todayLocal } from '../../lib/recurrence';

/** Mail is fetched on demand through the Gmail API (All Mail by default) and never stored in Cosmos OS. */
export const GmailModal: React.FC = () => {
  const { isGmailOpen, setGmailOpen, addTask } = useApp();
  const { isConnected, connect, gmailList, gmailGet, busy } = useIntegrations();
  const connected = isConnected('gmail');

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GmailMessageFull | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const reqId = useRef(0);                         // ignore responses from superseded searches

  const search = useCallback(async (q: string, pageToken?: string) => {
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const r = await gmailList(q, pageToken);
      if (id !== reqId.current) return;
      setMessages((prev) => (pageToken ? [...prev, ...r.messages] : r.messages));
      setNext(r.nextPageToken);
    } catch (e) { if (id === reqId.current) setError((e as Error).message); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [gmailList]);

  useEffect(() => { if (isGmailOpen && connected) { setOpen(null); void search(''); } }, [isGmailOpen, connected]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isGmailOpen) setGmailOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isGmailOpen, setGmailOpen]);

  if (!isGmailOpen) return null;

  const read = async (m: GmailMessageSummary) => {
    setOpening(m.id); setError(null);
    try { setOpen(await gmailGet(m.id)); } catch (e) { setError((e as Error).message); } finally { setOpening(null); }
  };
  const toTask = (m: GmailMessageFull) => addTask({
    title: `Email: ${m.subject}`.slice(0, 200), description: `From ${m.from}\n${m.webLink}`,
    list: 'Inbox', priority: 'MEDIUM', status: 'todo', dueDate: todayLocal(),
  });

  const shell = 'w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] text-[#252821] dark:text-[#ECEDE6]';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setGmailOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Gmail" onClick={(e) => e.stopPropagation()} className={shell}>
        <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold"><Mail className="h-4 w-4" /> Gmail <span className="text-[11px] font-normal text-[#8A8E85]">All Mail</span></div>
          <button onClick={() => setGmailOpen(false)} aria-label="Close" className="rounded-md p-1 hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"><X className="h-4 w-4" /></button>
        </div>

        {!connected ? (
          <div className="p-5">
            <p className="text-sm font-semibold">Not connected</p>
            <p className="mt-1 text-xs text-[#6B7067] dark:text-[#A6AB9F]">Signing in to Cosmos OS doesn’t grant mailbox access. Connecting asks Google for read-only Gmail permission.</p>
            <button onClick={() => connect('gmail')} disabled={busy === 'gmail'} className="mt-4 rounded-lg bg-[#526B55] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#405541] disabled:opacity-50">
              {busy === 'gmail' ? 'Opening…' : 'Connect Gmail'}
            </button>
          </div>
        ) : open ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <button onClick={() => setOpen(null)} className="flex items-center gap-1 text-xs font-semibold text-[#6B7067] hover:underline"><ArrowLeft className="h-3 w-3" /> Back to results</button>
            <h2 className="text-sm font-bold break-words">{open.subject}</h2>
            <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">{open.from} · {open.date}</p>
            <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">{open.bodyText || '(No text content)'}</pre>
            {open.attachments.length > 0 && <p className="text-[11px] text-[#6B7067]">Attachments (open in Gmail to download): {open.attachments.map((a) => a.filename).join(', ')}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <a href={open.webLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-[#DFE1D9] dark:border-[#383D35] px-3 py-1.5 text-xs font-semibold hover:bg-[#F0F1EB] dark:hover:bg-[#292D27]"><ExternalLink className="h-3 w-3" /> Open in Gmail</a>
              <button onClick={() => toTask(open)} className="flex items-center gap-1.5 rounded-lg bg-[#3D5240] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white"><ListPlus className="h-3 w-3" /> Create task</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 border-b border-[#DFE1D9] dark:border-[#383D35] p-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8A8E85]" />
                <input aria-label="Search mail" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void search(query.trim()); }}
                  placeholder="Search all mail, e.g. from:alice has:attachment"
                  className="w-full rounded-lg border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-[#526B55]" />
              </div>
              <button onClick={() => void search(query.trim())} className="rounded-lg bg-[#3D5240] dark:bg-[#526B55] px-3 text-xs font-bold text-white">Search</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {error && <div role="alert" className="m-3 rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-xs text-rose-800 dark:text-rose-300">{error} <button className="underline ml-1" onClick={() => void search(query.trim())}>Retry</button></div>}
              {!loading && !error && messages.length === 0 && <p className="p-6 text-center text-xs text-[#8A8E85]">No messages match.</p>}
              <ul>
                {messages.map((m) => (
                  <li key={m.id}>
                    <button onClick={() => void read(m)} disabled={opening === m.id}
                      className="block w-full border-b border-[#ECEDE7] dark:border-[#2A2E28] px-4 py-2.5 text-left hover:bg-[#F5F5F0] dark:hover:bg-[#292D27]">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-xs ${m.unread ? 'font-bold' : 'font-medium'}`}>{m.from.replace(/<.*>/, '').trim() || m.from}</span>
                        <span className="shrink-0 text-[10px] text-[#8A8E85]">{m.date.slice(0, 16)}</span>
                      </div>
                      <div className={`truncate text-xs ${m.unread ? 'font-semibold' : ''}`}>{m.subject}</div>
                      <div className="truncate text-[11px] text-[#8A8E85]">{opening === m.id ? 'Opening…' : m.snippet}</div>
                    </button>
                  </li>
                ))}
              </ul>
              {loading && <p role="status" className="p-4 text-center text-xs text-[#8A8E85]">Loading…</p>}
              {next && !loading && <div className="p-3 text-center"><button onClick={() => void search(query.trim(), next)} className="text-xs font-semibold underline">Load more</button></div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
