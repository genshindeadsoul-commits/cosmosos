import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Play, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useIntegrations } from '../../context/IntegrationsContext';
import { usePrefs } from '../../context/PrefsContext';
import { parseMusicLink, PROVIDER_LABEL } from '../../lib/musicLinks';
import { activeFrom, addPlaylist, libraryFrom, movePlaylist, removePlaylist, renamePlaylist, togglePlaylist, type PlaylistItem } from '../../lib/playlists';

const input = 'w-full rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1.5 text-xs text-[#252821] dark:text-[#ECEDE6] focus:outline-none focus:ring-1 focus:ring-[#526B55]';
const btn = 'rounded border border-[#DFE1D9] dark:border-[#383D35] px-2 py-1 text-xs font-semibold hover:bg-[#F0F1EB] dark:hover:bg-[#292D27] disabled:opacity-40';
const primary = 'rounded bg-[#3D5240] dark:bg-[#526B55] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50';

const Row: React.FC<{ item: PlaylistItem; first: boolean; last: boolean; onChange: (lib: (l: PlaylistItem[]) => PlaylistItem[]) => void; onPlay: () => void }> = ({ item, first, last, onChange, onPlay }) => {
  const [name, setName] = useState(item.name);
  const [confirm, setConfirm] = useState(false);
  const commit = () => { if (name.trim() && name.trim() !== item.name) onChange((l) => renamePlaylist(l, item.id, name)); else setName(item.name); };
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-[#ECEDE7] dark:border-[#2A2E28] py-2">
      <input aria-label={`Name for ${item.name}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className={`${input} min-w-[8rem] flex-1`} />
      <span className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">{PROVIDER_LABEL[item.provider]} · {item.kind}</span>
      <label className="flex items-center gap-1 text-[11px]">
        <input type="checkbox" role="switch" aria-label={`Enable ${item.name}`} checked={item.enabled} onChange={() => onChange((l) => togglePlaylist(l, item.id))} />
        {item.enabled ? 'On' : 'Off'}
      </label>
      <button className={btn} aria-label={`Move ${item.name} up`} disabled={first} onClick={() => onChange((l) => movePlaylist(l, item.id, -1))}><ArrowUp className="h-3 w-3" /></button>
      <button className={btn} aria-label={`Move ${item.name} down`} disabled={last} onClick={() => onChange((l) => movePlaylist(l, item.id, 1))}><ArrowDown className="h-3 w-3" /></button>
      <button className={btn} aria-label={`Play ${item.name}`} disabled={!item.enabled} title={item.enabled ? 'Play in the music hub' : 'Turn it on first'} onClick={onPlay}><Play className="h-3 w-3" /></button>
      {confirm ? (
        <span className="flex items-center gap-1 text-[11px]">Remove? <button className="font-bold text-rose-700 dark:text-rose-400 underline" onClick={() => onChange((l) => removePlaylist(l, item.id))}>Yes</button><button className="underline" onClick={() => setConfirm(false)}>No</button></span>
      ) : <button className={btn} aria-label={`Remove ${item.name}`} onClick={() => setConfirm(true)}><Trash2 className="h-3 w-3" /></button>}
    </li>
  );
};

export const MusicSettingsPanel: React.FC = () => {
  const { prefs, update } = usePrefs();
  const { openMusicWidget } = useApp();
  const { integrations, connect, disconnect, busy } = useIntegrations();
  const lib = libraryFrom(prefs);
  const spotify = integrations.find((i) => i.id === 'spotify');
  const spotifyConnected = spotify?.status === 'connected';
  const [link, setLink] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const preview = link.trim() ? parseMusicLink(link) : null;

  // Pin whatever is currently playing before ANY list edit, so adding/reordering/disabling other playlists can never
  // silently switch (and interrupt) the active one. If the active playlist itself is disabled or removed, the hub
  // falls back to the first enabled one.
  const pinned = activeFrom(prefs)?.id;
  const save = (next: PlaylistItem[]) => update({ playlists: next, activePlaylistId: pinned });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const r = addPlaylist(lib, link, name, crypto.randomUUID());
    if (!r.ok) { setError(r.error); return; }
    setError(null); setLink(''); setName('');
    update({ playlists: r.lib, activePlaylistId: pinned ?? r.item.id });          // a new playlist only becomes active if nothing is
  };

  return (
    <section aria-labelledby="music-settings" className="rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] p-5 space-y-4 text-[#252821] dark:text-[#ECEDE6]">
      <div>
        <h2 id="music-settings" className="text-sm font-bold">Music &amp; Playlists</h2>
        <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">Choose what appears in the music hub (the music-note icon in the top bar). Only playlists you add here and switch on are shown; Cosmos OS never lists your whole library.</p>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded border border-[#DFE1D9] dark:border-[#383D35] p-3">
          <p className="font-semibold">Apple Music</p>
          <p className="mt-0.5 text-[#6B7067] dark:text-[#A6AB9F]">Plays through Apple’s own embedded player. No account connection is needed here: Apple handles sign-in and subscription inside the player.</p>
        </div>
        <div className="rounded border border-[#DFE1D9] dark:border-[#383D35] p-3">
          <p className="font-semibold">Spotify <span className="font-normal text-[#6B7067] dark:text-[#A6AB9F]">· {spotifyConnected ? `connected${spotify?.connectedEmail ? ` as ${spotify.connectedEmail}` : ''}` : 'not connected'}</span></p>
          <p className="mt-0.5 text-[#6B7067] dark:text-[#A6AB9F]">Spotify links play in Spotify’s embedded player without connecting (full songs only if you’re signed in to Spotify in this browser). Connecting adds remote control of an open Spotify device and needs Premium.</p>
          <div className="mt-2">
            {spotifyConnected
              ? <button className={btn} disabled={busy === 'spotify'} onClick={() => void disconnect('spotify')}>Disconnect Spotify</button>
              : <button className={btn} disabled={busy === 'spotify'} onClick={() => void connect('spotify')}>{busy === 'spotify' ? 'Opening…' : 'Connect Spotify'}</button>}
          </div>
        </div>
      </div>

      <form onSubmit={add} className="space-y-2">
        <label htmlFor="music-link" className="block text-xs font-semibold">Add a playlist, album, or track link</label>
        <div className="flex flex-wrap gap-2">
          <input id="music-link" value={link} onChange={(e) => { setLink(e.target.value); setError(null); }} placeholder="https://music.apple.com/… or https://open.spotify.com/…" autoComplete="off" spellCheck={false} className={`${input} min-w-[14rem] flex-[2]`} />
          <input aria-label="Display name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Name (optional)" className={`${input} min-w-[8rem] flex-1`} />
          <button className={primary} disabled={!link.trim()}>Add</button>
        </div>
        {preview && (preview.ok
          ? <p className="text-[11px] text-[#3D5240] dark:text-[#A8BDA1]">Recognized: {PROVIDER_LABEL[preview.provider]} {preview.kind}.</p>
          : <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">{preview.error}</p>)}
        {error && <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-400">{error}</p>}
      </form>

      {lib.length === 0
        ? <p className="text-xs text-[#6B7067] dark:text-[#A6AB9F]">No playlists yet. Add a link above and it will appear in the music hub.</p>
        : <ul aria-label="Your playlists">{lib.map((p, i) => <Row key={p.id} item={p} first={i === 0} last={i === lib.length - 1} onChange={(fn) => save(fn(lib))} onPlay={() => { update({ activePlaylistId: p.id }); openMusicWidget(); }} />)}</ul>}
      <p className="text-[11px] text-[#8A8E85]">Playback uses each provider’s own player, so its controls live inside the player. Subscriptions, region limits, and browser autoplay rules still apply, and Cosmos OS can’t tell whether a particular track is playable.</p>
    </section>
  );
};
