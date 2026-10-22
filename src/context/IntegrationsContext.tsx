import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { IntegrationAccount } from '../types';
import { INTEGRATION_CATALOG } from '../data/integrations';
import { requireSupabase } from '../lib/supabase';
import { callFn, GmailMessageFull, GmailMessageSummary, ImportedEvent, IntegrationError, SendInput } from '../lib/integrationsApi';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';

/** UI id -> provider key stored in integration_connections / used by Edge Functions. */
const OAUTH_PROVIDER: Record<string, string> = { gcal: 'google_calendar', gmail: 'gmail', gsheets: 'google_sheets', spotify: 'spotify' };

interface Connection { provider: string; status: string; account_label: string | null; last_synced_at: string | null; last_error: string | null; granted_scopes: string[] | null }
interface IngestToken { id: string; label: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

interface IntegrationsContextType {
  integrations: IntegrationAccount[];
  connectionsLoaded: boolean;
  isConnected: (uiId: string) => boolean;
  connect: (uiId: string) => Promise<void>;
  disconnect: (uiId: string) => Promise<void>;
  sync: (uiId: string) => Promise<void>;
  busy: string | null;
  gmailScopes: string[];
  connectGmail: (capabilities?: ('modify' | 'send')[]) => Promise<void>;
  gmailList: (folder: string, q: string, pageToken?: string) => Promise<{ messages: GmailMessageSummary[]; nextPageToken: string | null }>;
  gmailGet: (id: string) => Promise<GmailMessageFull>;
  gmailAttachment: (id: string, attachmentId: string) => Promise<{ size: number; data: string }>;
  gmailModify: (id: string, add: string[], remove: string[]) => Promise<{ unread: boolean; starred: boolean }>;
  gmailSend: (m: SendInput) => Promise<{ id: string; threadId: string }>;
  sheetsPreview: (spreadsheetId: string, range?: string) => Promise<{ title: string; values: string[][] }>;
  healthTokens: IngestToken[];
  createHealthToken: (label: string) => Promise<string>;
  revokeHealthToken: (id: string) => Promise<void>;
}

const Ctx = createContext<IntegrationsContextType | undefined>(undefined);

export const IntegrationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast, importCalendarEvents } = useApp();
  const { user } = useAuth();
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  const [connectionsLoaded, setLoaded] = useState(false);
  const [healthTokens, setHealthTokens] = useState<IngestToken[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = requireSupabase();
    const [c, t] = await Promise.all([
      sb.from('integration_connections').select('provider,status,account_label,last_synced_at,last_error,granted_scopes'),
      sb.from('health_ingest_tokens').select('id,label,created_at,last_used_at,revoked_at').order('created_at', { ascending: false }),
    ]);
    if (!c.error) setConnections(Object.fromEntries((c.data ?? []).map((r: Connection) => [r.provider, r])));
    if (!t.error) setHealthTokens((t.data ?? []) as IngestToken[]);
    setLoaded(true);
  }, []);

  useEffect(() => { if (user) void refresh(); }, [user?.id, refresh]);

  // Returning from Google/Spotify: the callback redirects here with a result in the query string.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get('integration_error'), ok = q.get('result');
    if (!err && !ok) return;
    if (err) showToast(err, 'error'); else showToast('Connected.', 'success');
    ['integration', 'result', 'integration_error'].forEach((k) => q.delete(k));
    window.history.replaceState({}, document.title, window.location.pathname + (q.toString() ? `?${q}` : ''));
    void refresh();
  }, []);

  const integrations: IntegrationAccount[] = useMemo(() => INTEGRATION_CATALOG.map((item) => {
    const prov = OAUTH_PROVIDER[item.id] ?? (item.id === 'health' ? 'health_connect' : undefined);
    const c = prov ? connections[prov] : undefined;
    if (!c) return item;
    const status = c.status === 'connected' ? 'connected' : c.status === 'needs_reauthorization' ? 'needs_reauthorization' : c.status === 'error' ? 'error' : item.status;
    return { ...item, status, connectedEmail: c.account_label ?? undefined, lastSync: c.last_synced_at ? new Date(c.last_synced_at).toLocaleString() : undefined,
      description: c.last_error && status !== 'connected' ? `${item.description} Last error: ${c.last_error}` : item.description } as IntegrationAccount;
  }), [connections]);

  const isConnected = (uiId: string) => integrations.find((i) => i.id === uiId)?.status === 'connected';

  const guard = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e) { showToast((e as Error).message, 'error'); }
    finally { setBusy(null); }
  };

  const connect = (uiId: string) => guard(uiId, async () => {
    const provider = OAUTH_PROVIDER[uiId];
    if (!provider) throw new IntegrationError('unsupported', 'This connector is connected differently or isn’t available yet.');
    const { url } = await callFn<{ url: string }>('oauth-start', { provider });
    window.location.assign(url);                // full-page redirect to the provider's consent screen
  });

  const disconnect = (uiId: string) => guard(uiId, async () => {
    const provider = OAUTH_PROVIDER[uiId];
    if (!provider) return;
    await callFn('oauth-disconnect', { provider });
    await refresh();
    showToast('Disconnected. Stored access was deleted.', 'success');
  });

  const sync = (uiId: string) => guard(uiId, async () => {
    if (uiId === 'gcal') {
      const r = await callFn<{ events: ImportedEvent[]; truncated: boolean }>('calendar-import');
      const { added, updated } = importCalendarEvents(r.events);
      await refresh();
      showToast(`Imported ${added} new and updated ${updated} Google Calendar events${r.truncated ? ' (more exist; showing the first 750)' : ''}.`, 'success');
    } else if (uiId === 'gmail') {
      await refresh(); showToast('Open Gmail from the sidebar to browse mail.', 'info');
    } else {
      showToast('Nothing to sync for this connector.', 'info');
    }
  });

  const gmailScopes = connections['gmail']?.status === 'connected' ? connections['gmail'].granted_scopes ?? [] : [];
  const connectGmail = (capabilities?: ('modify' | 'send')[]) => guard('gmail', async () => {
    const { url } = await callFn<{ url: string }>('oauth-start', { provider: 'gmail', ...(capabilities?.length ? { capabilities } : {}) });
    window.location.assign(url);
  });
  const gmailList = async (folder: string, q: string, pageToken?: string) =>
    callFn<{ messages: GmailMessageSummary[]; nextPageToken: string | null }>('gmail', { action: 'list', folder, q, pageToken });
  const gmailGet = async (id: string) => callFn<GmailMessageFull>('gmail', { action: 'get', id });
  const gmailAttachment = async (id: string, attachmentId: string) => callFn<{ size: number; data: string }>('gmail', { action: 'attachment', id, attachmentId });
  const gmailModify = async (id: string, add: string[], remove: string[]) => callFn<{ unread: boolean; starred: boolean }>('gmail', { action: 'modify', id, addLabelIds: add, removeLabelIds: remove });
  const gmailSend = async (m: SendInput) => callFn<{ id: string; threadId: string }>('gmail', { action: 'send', ...m });
  const sheetsPreview = async (spreadsheetId: string, range?: string) =>
    callFn<{ title: string; values: string[][] }>('sheets-preview', { spreadsheetId, range });

  const createHealthToken = async (label: string) => {
    const { data, error } = await requireSupabase().rpc('create_health_ingest_token', { p_label: label });
    if (error) throw new Error(error.message);
    await refresh();
    return data as string;                       // plaintext, shown once, never retrievable again
  };
  const revokeHealthToken = async (id: string) => {
    const { error } = await requireSupabase().rpc('revoke_health_ingest_token', { p_id: id });
    if (error) throw new Error(error.message);
    await refresh();
  };

  return (
    <Ctx.Provider value={{ integrations, connectionsLoaded, isConnected, connect, disconnect, sync, busy, gmailScopes, connectGmail, gmailList, gmailGet, gmailAttachment, gmailModify, gmailSend, sheetsPreview, healthTokens, createHealthToken, revokeHealthToken }}>
      {children}
    </Ctx.Provider>
  );
};

export function useIntegrations(): IntegrationsContextType {
  const c = useContext(Ctx);
  if (!c) throw new Error('useIntegrations must be used inside IntegrationsProvider');
  return c;
}
