import type { IntegrationAccount } from '../types';

/**
 * Static catalog of connectors. Status is NEVER "connected" here: that state requires a
 * real authorized API request (server-side) and is read from `integration_connections`.
 */
export const INTEGRATION_CATALOG: IntegrationAccount[] = [
  { id: 'gcal', name: 'Google Calendar', description: 'One-way import of your primary Google Calendar (30 days back, 12 months ahead). Re-importing updates events instead of duplicating them; deletions in Google are not mirrored.',
    status: 'not_connected', permissions: ['calendar.readonly'], syncDirection: 'One-way import (Google → Cosmos), not two-way sync' },
  { id: 'gdrive', name: 'Google Drive', description: 'Not available in this build. Linking Drive files needs the Google Picker (API key + client script). Paste a Drive link into a note in the meantime.',
    status: 'config_required', permissions: ['None (not implemented)'], syncDirection: 'Reference linking' },
  { id: 'gsheets', name: 'Google Sheets', description: 'Read-only import: paste a spreadsheet link, preview it, then create a table. Export to Sheets and live sync are not implemented.',
    status: 'not_connected', permissions: ['spreadsheets.readonly'], syncDirection: 'Explicit import / export' },
  { id: 'gmail', name: 'Gmail', description: 'Browse and search your full mailbox (All Mail, excluding spam and trash). Messages are fetched on demand and never copied into Cosmos OS.',
    status: 'not_connected', permissions: ['gmail.readonly'], syncDirection: 'Read via API; references stored, not mailbox copies' },
  { id: 'reminders', name: 'Browser reminders', description: 'In-app reminders. Background delivery depends on the browser; permission is requested only when you enable it.',
    status: 'not_connected', permissions: ['Notification permission'], syncDirection: 'Local' },
  { id: 'health', name: 'Health Connect / Google Fit', description: 'A browser cannot read Health Connect. Pair an Android companion app with a personal ingest token (below); synced workouts appear in Fitness. Manual logging always works.',
    status: 'not_connected', permissions: ['Per-user ingest token (revocable)'], syncDirection: 'Companion → Cosmos (not available yet)' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Opens official WhatsApp (click-to-chat) and lets you save follow-ups. Cosmos OS cannot read or sync your chats.',
    status: 'not_connected', permissions: ['None (opens wa.me)'], syncDirection: 'None' },
  { id: 'spotify', name: 'Spotify', description: 'Remote-control playback on a device where Spotify is already open. Requires Spotify Premium. Cosmos OS does not stream audio itself.',
    status: 'not_connected', permissions: ['user-read-playback-state', 'user-modify-playback-state'], syncDirection: 'Remote control' },
  { id: 'apple_music', name: 'Apple Music', description: 'Authorize Apple Music in the mini-player (MusicKit). Requires an Apple Music subscription and server-side developer credentials.',
    status: 'not_connected', permissions: ['MusicKit user authorization (per browser)'], syncDirection: 'Playback' },
];
