import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { usePrefs } from '../../context/PrefsContext';
import { clampBox } from '../../lib/appleEmbed';
import { PROVIDER_LABEL } from '../../lib/musicLinks';
import { activeFrom, enabledPlaylists, libraryFrom } from '../../lib/playlists';
import { useApp } from '../../context/AppContext';

const BAR = 32;
const SIZES = { compact: { w: 340, h: 175 }, expanded: { w: 400, h: 450 } } as const;
const MOBILE = 640;
const SLOW_MS = 12000;
const SANDBOX =
  'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation';
const ALLOW = 'autoplay *; encrypted-media *; fullscreen *; clipboard-write';

/** Isolated + memoized so dragging, resizing and unrelated app updates never touch the iframe DOM node. */
const EmbedFrame = memo(function EmbedFrame({ src, onLoad }: { src: string; onLoad: () => void }) {
  return (
    <iframe
      title="Apple Music player"
      src={src}
      onLoad={onLoad}
      allow={ALLOW}
      sandbox={SANDBOX}
      className="block h-full w-full border-0 bg-transparent"
    />
  );
});

/**
 * A movable shell around Apple Music's official embedded player.
 * Only one instance exists. It plays playlists added and enabled in Settings → Music & Playlists.
 * Visibility is never persisted (always starts closed on refresh).
 * Minimize keeps the iframe mounted (audio continues). Close unmounts it (playback stops).
 */
export const AppleMusicWidget: React.FC = () => {
  const { prefs, update } = usePrefs();
  const { musicHub, closeMusicHub, setMusicMinimized, setActiveModule, openMusicHub } = useApp();
  const am = prefs.appleMusic ?? {};
  const mode = am.mode === 'expanded' ? 'expanded' : 'compact';
  const choices = enabledPlaylists(libraryFrom(prefs));
  const active = activeFrom(prefs);
  const label = active ? PROVIDER_LABEL[active.provider] : 'Apple Music';
  const isOpen = musicHub.open || Boolean(prefs.appleMusic?.visible);

  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  useEffect(() => {
    const f = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  const mobile = vw < MOBILE;

  const base = SIZES[mode === 'expanded' ? 'expanded' : 'compact'];
  const box = clampBox(
    {
      x: am.x ?? vw - base.w - 24,
      y: am.y ?? vh - base.h - BAR - 24,
      w: am.w ?? base.w,
      h: am.h ?? base.h,
    },
    vw,
    vh,
    BAR
  );

  // Focus ring indicator when re-opened or focused while already open
  const [highlight, setHighlight] = useState(false);
  const prevFocusRef = useRef(musicHub.focusTick);
  useEffect(() => {
    if (musicHub.open && musicHub.focusTick !== prevFocusRef.current) {
      prevFocusRef.current = musicHub.focusTick;
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 1200);
      return () => clearTimeout(timer);
    }
    prevFocusRef.current = musicHub.focusTick;
  }, [musicHub.open, musicHub.focusTick]);

  // Load state: cross-origin, so we only know that the frame fired `load`
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'slow'>('loading');
  const [nonce, setNonce] = useState(0);
  const embedUrl = active?.embedUrl;
  useEffect(() => {
    if (!embedUrl || !isOpen) return;
    setLoadState('loading');
    const t = setTimeout(() => setLoadState((s) => (s === 'loading' ? 'slow' : s)), SLOW_MS);
    return () => clearTimeout(t);
  }, [embedUrl, isOpen, nonce]);
  const onLoad = useCallback(() => setLoadState('loaded'), []);

  // Drag & resize (pointer events; disabled on phones where widget docks to the bottom).
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current) {
      drag.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore if not captured
      }
    }
  };
  const onBarDown = (e: React.PointerEvent) => {
    if (mobile || (e.target as HTMLElement).closest('button, select, a')) return;
    drag.current = { dx: e.clientX - box.x, dy: e.clientY - box.y };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const b = clampBox({ ...box, x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }, vw, vh, BAR);
    update({ appleMusic: { x: b.x, y: b.y, w: b.w, h: b.h } });
  };

  const rs = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const endResize = (e: React.PointerEvent) => {
    if (rs.current) {
      rs.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };
  const onResizeDown = (e: React.PointerEvent) => {
    rs.current = { x: e.clientX, y: e.clientY, w: box.w, h: box.h };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    e.stopPropagation();
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!rs.current) return;
    const b = clampBox(
      {
        ...box,
        w: Math.min(rs.current.w + e.clientX - rs.current.x, 640),
        h: Math.min(rs.current.h + e.clientY - rs.current.y, 640),
      },
      vw,
      vh,
      BAR,
      280,
      175
    );
    update({ appleMusic: { w: b.w, h: b.h } });
  };

  if (!isOpen) return null;

  const minimized = musicHub.minimized;
  const style: React.CSSProperties = mobile
    ? { left: 8, right: 8, bottom: 8, width: 'auto' }
    : { left: box.x, top: box.y, width: box.w };
  const bodyH = minimized ? 0 : mobile ? (mode === 'expanded' ? Math.min(450, vh * 0.5) : 175) : box.h;
  const iconBtn = 'rounded p-1 hover:bg-black/10 dark:hover:bg-white/10';

  return (
    <section
      aria-label={active ? label : 'Music player'}
      style={style}
      className={`fixed z-40 overflow-hidden rounded-md border border-[#DFE1D9] dark:border-[#383D35] bg-white dark:bg-[#20231F] shadow-lg text-[#252821] dark:text-[#ECEDE6] transition-shadow duration-300 ${
        highlight ? 'ring-2 ring-[#526B55] dark:ring-[#A8BDA1] shadow-2xl' : ''
      }`}
    >
      <div
        onPointerDown={onBarDown}
        onPointerMove={onBarMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        style={{ height: BAR, touchAction: 'none' }}
        className={`flex items-center justify-between gap-1 px-2 text-xs font-semibold select-none ${
          mobile ? '' : 'cursor-move'
        } bg-[#F0F1EB] dark:bg-[#292D27]`}
      >
        <span className="truncate">{label}{active ? ` · ${active.kind}` : ''}</span>
        <div className="flex items-center">
          {active && (
            <a
              aria-label={`Open in ${label}`}
              title={`Open in ${label}`}
              href={active.openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={iconBtn}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {!minimized && (
            <button
              aria-label={mode === 'expanded' ? 'Compact size' : 'Expand'}
              title={mode === 'expanded' ? 'Compact size' : 'Expand'}
              onClick={() =>
                update({
                  appleMusic: {
                    mode: mode === 'expanded' ? 'compact' : 'expanded',
                    w: SIZES[mode === 'expanded' ? 'compact' : 'expanded'].w,
                    h: SIZES[mode === 'expanded' ? 'compact' : 'expanded'].h,
                  },
                })
              }
              className={iconBtn}
            >
              {mode === 'expanded' ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            aria-label={minimized ? 'Restore player' : 'Minimize player'}
            title={minimized ? 'Restore (audio keeps playing while minimized)' : 'Minimize (audio keeps playing)'}
            onClick={() => setMusicMinimized(!minimized)}
            className={iconBtn}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            aria-label="Hide player"
            title="Hide (stops playback)"
            onClick={() => {
              closeMusicHub();
              update({ appleMusic: { visible: false } });
            }}
            className={iconBtn}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!minimized && choices.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[#DFE1D9] dark:border-[#383D35] px-2 py-1">
          {choices.length > 1 ? (
            <select
              aria-label="Playlist"
              value={active?.id}
              onChange={(e) => update({ activePlaylistId: e.target.value })}
              className="min-w-0 flex-1 rounded border border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0] dark:bg-[#181A17] px-1.5 py-0.5 text-xs"
            >
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-xs">{active?.name}</span>
          )}
          <button onClick={() => setActiveModule('settings')} className="shrink-0 text-[11px] underline">
            Manage
          </button>
        </div>
      )}

      {!active && !minimized && (
        <div className="space-y-2 p-3 text-xs">
          <p className="font-semibold">No playlists enabled</p>
          <p className="text-[#6B7067] dark:text-[#A6AB9F]">
            Add an Apple Music playlist link, or switch one on, in Settings → Music &amp; Playlists. Only playlists you choose
            appear here.
          </p>
          <button
            onClick={() => setActiveModule('settings')}
            className="rounded bg-[#3D5240] dark:bg-[#526B55] px-2.5 py-1 font-bold text-white"
          >
            Open Music &amp; Playlists
          </button>
        </div>
      )}

      {active && (
        <div style={{ height: bodyH, overflow: 'hidden' }} aria-hidden={minimized}>
          <div className="relative h-full w-full">
            <EmbedFrame key={`${active.embedUrl}#${nonce}`} src={active.embedUrl} onLoad={onLoad} />
            {loadState === 'loading' && !minimized && (
              <p role="status" className="pointer-events-none absolute inset-x-0 top-1 text-center text-[11px] text-[#6B7067]">
                Loading {label}…
              </p>
            )}
            {loadState === 'slow' && !minimized && (
              <div
                role="alert"
                className="absolute inset-x-2 bottom-2 rounded border border-amber-400 bg-amber-50 dark:bg-amber-950/60 p-2 text-[11px]"
              >
                Still loading. {label}’s player may be blocked by your network or browser, or the link may be unavailable in
                your country.
                <span className="mt-1 flex gap-3">
                  <button className="font-bold underline" onClick={() => setNonce((n) => n + 1)}>
                    Retry
                  </button>
                  <a className="font-bold underline" href={active.openUrl} target="_blank" rel="noopener noreferrer">
                    Open in {label}
                  </a>
                </span>
              </div>
            )}
          </div>
          {!mobile && !minimized && (
            <div
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onLostPointerCapture={() => {
                rs.current = null;
              }}
              aria-hidden="true"
              style={{ touchAction: 'none' }}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
            />
          )}
        </div>
      )}
    </section>
  );
};
