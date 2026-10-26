import type { IntegrationAccount } from '../types';

/**
 * Static catalog of connectors. Status is NEVER "connected" here: that state requires a
 * real authorized API request (server-side) and is read from `integration_connections`.
 */
export const INTEGRATION_CATALOG: IntegrationAccount[] = [
  { id: 'gcal', name: 'Google Calendar', description: 'One-way import of your primary Google Calendar (30 days back, 12 months ahead). Re-importing updates events instead of duplicating them; deletions in Google are not mirrored.',
    status: 'not_connected', permissions: ['calendar.readonly'], syncDirection: 'One-way import (Google → Cosmos), not two-way sync' },
  { id: 'gdrive', name: 'Google Drive', description: 'Manual backup and restore, managed under Backup & Restore. Cosmos OS can only see the backup files it creates itself.',
    status: 'not_connected', permissions: ['drive.file (files created by Cosmos OS only)'], syncDirection: 'Manual backup / restore' },
  { id: 'gsheets', name: 'Google Sheets', description: 'Read-only import: paste a spreadsheet link, preview it, then create a table. Export to Sheets and live sync are not implemented.',
    status: 'not_connected', permissions: ['spreadsheets.readonly'], syncDirection: 'Explicit import / export' },
  { id: 'gmail', name: 'Gmail', description: 'Browse and search your full mailbox (All Mail, excluding spam and trash). Messages are fetched on demand and never copied into Cosmos OS.',
    status: 'not_connected', permissions: ['gmail.readonly'], syncDirection: 'Read via API; references stored, not mailbox copies' },
  { id: 'reminders', name: 'Browser reminders', description: 'In-app reminders. Background delivery depends on the browser; permission is requested only when you enable it.',
    status: 'not_connected', permissions: ['Notification permission'], syncDirection: 'Local' },
  { id: 'health', name: 'Health Connect / Google Fit', description: 'A browser cannot read Health Connect. Pair an Android companion app with a personal ingest token (below); synced workouts appear in Fitness. Manual logging always works.',
    status: 'not_connected', permissions: ['Per-user ingest token (revocable)'], syncDirection: 'Companion → Cosmos (not available yet)' },
  { id: 'spotify', name: 'Spotify', description: 'Remote-control playback on a device where Spotify is already open. Requires Spotify Premium. Cosmos OS does not stream audio itself.',
    status: 'not_connected', permissions: ['user-read-playback-state', 'user-modify-playback-state'], syncDirection: 'Remote control' },
  { id: 'apple_music', name: 'Apple Music', description: 'Paste a playlist or album link to play it in a floating widget using Apple’s official embedded player. No account connection or developer membership is needed here; Apple handles sign-in and subscription inside its player.',
    status: 'not_connected', permissions: ['None (Apple’s embed handles its own sign-in)'], syncDirection: 'None' },
];
