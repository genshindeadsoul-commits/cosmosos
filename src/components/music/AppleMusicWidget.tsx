import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { usePrefs } from '../../context/PrefsContext';
import { clampBox, parseAppleMusicUrl } from '../../lib/appleEmbed';
import { useApp } from '../../context/AppContext';

const BAR = 32;
const SIZES = { compact: { w: 340, h: 175 }, expanded: { w: 400, h: 450 } } as const;
const MOBILE = 640;
const SLOW_MS = 12000;

/** Isolated + memoized so dragging, resizing and unrelated app updates never touch the iframe DOM node. */
const EmbedFrame = memo(function EmbedFrame({ src, onLoad }: { src: string; onLoad: () => void }) {
  return (
    <iframe
      title="Apple Music player"
      src={src}
      onLoad={onLoad}
      allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
      sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
      className="block h-full w-full border-0 bg-transparent"
    />
  );
});

/**
 * A movable shell around Apple's own embedded player. It cannot read or control playback (cross-origin iframe),
 * so it offers no play/pause/skip buttons of its own: use the controls inside the embed.
 * Minimize keeps the player mounted (audio continues). Hide unmounts it (playback stops).
 */
export const AppleMusicWidget: React.FC = () => {
  const { prefs, update } = usePrefs();
  const { musicWidgetRequest } = useApp();
  const am = prefs.appleMusic ?? {};
  const mode = am.mode ?? 'compact';
  const visible = am.visible ?? false;
  const parsed = am.url ? parseAppleMusicUrl(am.url) : null;
  const embed = parsed?.ok ? parsed : null;

  const [vw, setVw] = useState(window.innerWidth), [vh, setVh] = useState(window.innerHeight);
  useEffect(() => { const f = () => { setVw(window.innerWidth); setVh(window.innerHeight); }; window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const mobile = vw < MOBILE;

  const base = SIZES[mode === 'expanded' ? 'expanded' : 'compact'];
  const box = clampBox({ x: am.x ?? vw - base.w - 24, y: am.y ?? vh - base.h - BAR - 24, w: am.w ?? base.w, h: am.h ?? base.h }, vw, vh, BAR);

  // ----- load state (cross-origin: we can only know that the frame fired `load`, not why content failed) -----
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'slow'>('loading');
  const [nonce, setNonce] = useState(0);
  const embedUrl = embed?.embedUrl;
  useEffect(() => {
    if (!embedUrl || !visible) return;
    setLoadState('loading');
    const t = setTimeout(() => setLoadState((s) => (s === 'loading' ? 'slow' : s)), SLOW_MS);
    return () => clearTimeout(t);
  }, [embedUrl, visible, nonce]);
  const onLoad = useCallback(() => setLoadState('loaded'), []);

  // ----- change playlist -----
  const [draft, setDraft] = useState(am.url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!am.url);
  useEffect(() => { if (musicWidgetRequest) { setEditing(!am.url); update({ appleMusic: { visible: true, mode: mode === 'minimized' ? 'compact' : mode } }); } }, [musicWidgetRequest]);
  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const r = parseAppleMusicUrl(draft);
    if (!r.ok) { setError(r.error); return; }
    setError(null); setEditing(false);
    update({ appleMusic: { url: r.openUrl, visible: true, mode: mode === 'minimized' ? 'compact' : mode } });
  };

  // ----- drag & resize (pointer events; disabled on phones where the widget docks to the bottom) -----
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onBarDown = (e: React.PointerEvent) => {
    if (mobile || (e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - box.x, dy: e.clientY - box.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const b = clampBox({ ...box, x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, vw, vh, BAR);
    update({ appleMusic: { x: b.x, y: b.y, w: b.w, h: b.h } });
  };
  const onBarUp = () => { drag.current = null; };
  const rs = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => { rs.current = { x: e.clientX, y: e.clientY, w: box.w, h: box.h }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); e.stopPropagation(); };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!rs.current) return;
    const b = clampBox({ ...box, w: Math.min(rs.current.w + e.clientX - rs.current.x, 640), h: Math.min(rs.current.h + e.clientY - rs.current.y, 640) }, vw, vh, BAR, 280, 175);
    update({ appleMusic: { w: b.w, h: b.h } });
  };
  const onResizeUp = () => { rs.current = null; };

  if (!visible) return null;                      // Hide = unmount = playback stops (stated in the button label)

  const minimized = mode === 'minimized';
  const style: React.CSSProperties = mobile
    ? { left: 8, right: 8, bottom: 8, width: 'auto' }
    : { left: box.x, top: box.y, width: box.w };
  const bodyH = minimized ? 0 : mobile ? (mode === 'expanded' ? 450 : 175) : box.h;

  return (
    <section
      aria-label="Apple Music"
      style={style}
      className="fixed z-40 overflow-hidden rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] shadow-lg text-[#252821] dark:text-[#ECEDE6]"
    >
      <div
        onPointerDown={onBarDown} onPointerMove={onBarMove} onPointerUp={onBarUp}
        style={{ height: BAR, touchAction: 'none' }}
        className={`flex items-center justify-between gap-1 px-2 text-xs font-semibold select-none ${mobile ? '' : 'cursor-move'} bg-[#F0F1EB] dark:bg-[#292D27]`}
      >
        <span className="truncate">Apple Music{embed ? ` · ${embed.kind}` : ''}</span>
        <div className="flex items-center">
          {embed && <button aria-label="Change playlist or album" title="Change playlist or album" onClick={() => setEditing((v) => !v)} className="rounded px-1.5 py-0.5 hover:bg-black/10 dark:hover:bg-white/10">Change</button>}
          {embed && <a aria-label="Open in Apple Music" title="Open in Apple Music" href={embed.openUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"><ExternalLink className="h-3.5 w-3.5" /></a>}
          {!minimized && <button aria-label={mode === 'expanded' ? 'Compact size' : 'Expand'} title={mode === 'expanded' ? 'Compact size' : 'Expand'}
            onClick={() => update({ appleMusic: { mode: mode === 'expanded' ? 'compact' : 'expanded', w: SIZES[mode === 'expanded' ? 'compact' : 'expanded'].w, h: SIZES[mode === 'expanded' ? 'compact' : 'expanded'].h } })}
            className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10">{mode === 'expanded' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>}
          <button aria-label={minimized ? 'Restore player' : 'Minimize player'} title={minimized ? 'Restore (audio keeps playing while minimized)' : 'Minimize (audio keeps playing)'}
            onClick={() => update({ appleMusic: { mode: minimized ? 'compact' : 'minimized' } })} className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"><Minus className="h-3.5 w-3.5" /></button>
          <button aria-label="Hide player" title="Hide (stops playback)" onClick={() => update({ appleMusic: { visible: false } })} className="rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {(editing || !embed) && !minimized && (
        <form onSubmit={apply} className="space-y-1.5 p-2">
          <label className="block text-[11px] font-semibold text-[#6B7067] dark:text-[#A6AB9F]" htmlFor="apple-url">Apple Music playlist or album link</label>
          <div className="flex gap-1.5">
            <input id="apple-url" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://music.apple.com/us/playlist/…" autoComplete="off" spellCheck={false}
              className="min-w-0 flex-1 rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-2 py-1 text-xs" />
            <button className="rounded bg-[#3D5240] dark:bg-[#526B55] px-2.5 py-1 text-xs font-bold text-white">Load</button>
          </div>
          {error && <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-400">{error}</p>}
          {!embed && !error && <p className="text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">Playback uses Apple’s own player. A subscription may be required for full songs.</p>}
        </form>
      )}

      {embed && (
        <div style={{ height: bodyH, overflow: 'hidden' }} className={editing && !minimized ? 'hidden' : ''} aria-hidden={minimized}>
          <div className="relative h-full w-full">
            <EmbedFrame key={`${embed.embedUrl}#${nonce}`} src={embed.embedUrl} onLoad={onLoad} />
            {loadState === 'loading' && !minimized && <p role="status" className="pointer-events-none absolute inset-x-0 top-1 text-center text-[11px] text-[#6B7067]">Loading Apple Music…</p>}
            {loadState === 'slow' && !minimized && (
              <div role="alert" className="absolute inset-x-2 bottom-2 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/60 p-2 text-[11px]">
                Still loading. Apple’s player may be blocked by your network or browser, or the link may be unavailable in your country.
                <span className="mt-1 flex gap-3"><button className="font-bold underline" onClick={() => setNonce((n) => n + 1)}>Retry</button><a className="font-bold underline" href={embed.openUrl} target="_blank" rel="noopener noreferrer">Open in Apple Music</a></span>
              </div>
            )}
          </div>
          {!mobile && !minimized && <div onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={onResizeUp} aria-hidden="true" style={{ touchAction: 'none' }}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize" />}
        </div>
      )}
    </section>
  );
};
