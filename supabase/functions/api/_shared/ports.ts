import type { Provider } from './providers.ts';

export type ConnStatus = 'not_connected' | 'connected' | 'needs_reauthorization' | 'error';
export interface ConnPatch { status?: ConnStatus; account_label?: string | null; granted_scopes?: string[]; last_error?: string | null; last_synced_at?: string | null }

/** Everything the handlers need from storage. The Supabase implementation lives in supabaseDb.ts. */
export interface DbPort {
  insertState(state: string, userId: string, provider: Provider): Promise<void>;
  consumeState(state: string): Promise<{ userId: string; provider: Provider } | null>;
  getConnection(userId: string, provider: string): Promise<{ id: string; status: ConnStatus; granted_scopes: string[] } | null>;
  saveConnection(userId: string, provider: string, patch: ConnPatch): Promise<string>;
  getSecret(connectionId: string): Promise<string | null>;
  saveSecret(connectionId: string, encrypted: string): Promise<void>;
  deleteSecret(connectionId: string): Promise<void>;
  findIngestToken(hash: string): Promise<{ id: string; userId: string } | null>;
  touchIngestToken(id: string): Promise<void>;
  existingExternalIds(userId: string, ids: string[]): Promise<Set<string>>;
  insertWorkouts(userId: string, rows: Record<string, unknown>[]): Promise<number>;
}

export interface Ctx {
  env: Record<string, string | undefined>;
  db: DbPort;
  fetch: typeof fetch;
  now: () => Date;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}
