export type Provider = 'gmail' | 'google_calendar' | 'google_sheets' | 'google_drive' | 'spotify';

export interface ProviderConfig {
  authUrl: string; tokenUrl: string; scopes: string[]; requiredScope: string;
  clientIdEnv: string; clientSecretEnv: string;
  /** A REAL API request that must succeed before we ever mark the connection "connected". */
  verifyUrl: string;
  extraAuthParams: Record<string, string>;
}

const GOOGLE = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token',
  clientIdEnv: 'GOOGLE_CLIENT_ID', clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' },
};

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  gmail: { ...GOOGLE, scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'email'],
    requiredScope: 'https://www.googleapis.com/auth/gmail.readonly', verifyUrl: 'https://gmail.googleapis.com/gmail/v1/users/me/profile' },
  google_calendar: { ...GOOGLE, scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'email'],
    requiredScope: 'https://www.googleapis.com/auth/calendar.readonly', verifyUrl: 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1' },
  // Import-only: spreadsheets.readonly lets a pasted spreadsheet URL be read. Export is not implemented.
  google_sheets: { ...GOOGLE, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'email'],
    requiredScope: 'https://www.googleapis.com/auth/spreadsheets.readonly', verifyUrl: 'https://www.googleapis.com/oauth2/v3/userinfo' },
  // Backups only: drive.file = access to files THIS app created (never the rest of the user's Drive).
  google_drive: { ...GOOGLE, scopes: ['https://www.googleapis.com/auth/drive.file', 'email'],
    requiredScope: 'https://www.googleapis.com/auth/drive.file', verifyUrl: 'https://www.googleapis.com/drive/v3/about?fields=user' },
  spotify: { authUrl: 'https://accounts.spotify.com/authorize', tokenUrl: 'https://accounts.spotify.com/api/token',
    scopes: ['user-read-playback-state', 'user-modify-playback-state'], requiredScope: 'user-modify-playback-state',
    clientIdEnv: 'SPOTIFY_CLIENT_ID', clientSecretEnv: 'SPOTIFY_CLIENT_SECRET', verifyUrl: 'https://api.spotify.com/v1/me', extraAuthParams: { show_dialog: 'true' } },
};

export const isProvider = (p: unknown): p is Provider => typeof p === 'string' && Object.prototype.hasOwnProperty.call(PROVIDERS, p);

/** Gmail starts read-only. Extra capabilities are requested only when the user turns the feature on. */
export const GMAIL_SCOPE = {
  read: 'https://www.googleapis.com/auth/gmail.readonly',
  modify: 'https://www.googleapis.com/auth/gmail.modify',
  send: 'https://www.googleapis.com/auth/gmail.send',
} as const;
export type GmailCapability = 'modify' | 'send';
export const isGmailCapability = (c: unknown): c is GmailCapability => c === 'modify' || c === 'send';
