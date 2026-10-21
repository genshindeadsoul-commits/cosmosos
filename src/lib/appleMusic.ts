import { callFn } from './integrationsApi';

const SCRIPT = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
let instance: any = null;

function loadScript(): Promise<void> {
  if ((window as any).MusicKit) return Promise.resolve();
  return new Promise((resolve, reject) => {
    document.addEventListener('musickitloaded', () => resolve(), { once: true });
    const s = document.createElement('script');
    s.src = SCRIPT; s.async = true; s.crossOrigin = 'anonymous';
    s.onerror = () => reject(new Error('Could not load Apple MusicKit (blocked by network or an extension?).'));
    document.head.appendChild(s);
  });
}

/** Configures MusicKit with a server-signed developer token. Needs APPLE_* secrets deployed. */
async function ensure(): Promise<any> {
  if (instance) return instance;
  await loadScript();
  const { token } = await callFn<{ token: string }>('apple-music-token');
  await (window as any).MusicKit.configure({ developerToken: token, app: { name: 'Cosmos OS', build: '1' } });
  instance = (window as any).MusicKit.getInstance();
  return instance;
}

export async function appleAuthorize(): Promise<void> { const m = await ensure(); await m.authorize(); }
export async function appleIsAuthorized(): Promise<boolean> { try { return Boolean((await ensure()).isAuthorized); } catch { return false; } }

export async function appleState(): Promise<{ isPlaying: boolean; track: string; artist: string }> {
  const m = await ensure();
  const it = m.nowPlayingItem;
  return { isPlaying: m.isPlaying, track: it?.title ?? 'Nothing playing', artist: it?.artistName ?? '' };
}

/** With no queue, start from the user's recently played tracks so Play does something sensible. */
export async function applePlay(): Promise<void> {
  const m = await ensure();
  if (!m.isAuthorized) throw new Error('Authorize Apple Music first.');
  if (!m.nowPlayingItem) {
    const r = await m.api.music('v1/me/recent/played/tracks', { limit: 10 });
    const ids: string[] = (r?.data?.data ?? []).map((t: any) => t.id);
    if (!ids.length) throw new Error('No recently played Apple Music tracks to start from. Start something in the Apple Music app first.');
    await m.setQueue({ songs: ids });
  }
  await m.play();
}
export async function applePause() { (await ensure()).pause(); }
export async function appleNext() { await (await ensure()).skipToNextItem(); }
export async function applePrevious() { await (await ensure()).skipToPreviousItem(); }
