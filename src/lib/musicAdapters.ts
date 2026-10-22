import { ambientAudio } from './ambientAudio';

export type MusicProviderId = 'ambient' | 'spotify';

export interface ProviderPlaybackState {
  provider: MusicProviderId;
  isPlaying: boolean;
  currentTrack: string;
  artist: string;
  progressSeconds: number;
  durationSeconds: number;
  /** Whether this provider can actually play right now. Spotify/Apple stay false until real authorization exists. */
  available: boolean;
}

const AMBIENT_TITLES = {
  forest: 'Forest Canopy & Gentle Stream',
  rain: 'Deep Woodland Rain & Drops',
  alpha: 'Binaural Alpha Waves (216Hz)',
  celestial: 'Celestial Resonance (432Hz)',
} as const;
type Preset = keyof typeof AMBIENT_TITLES;

/**
 * Ambient = locally synthesized Web Audio (real). Spotify = remote control via the Web API (see AppContext). Apple Music lives in AppleMusicWidget (official embed):
 * they report "not connected" and never claim playback. Real support needs the official
 * Spotify Web Playback SDK / MusicKit JS flows with owner credentials (see docs/SETUP.md).
 */
export class MusicAdapterRegistry {
  private activeProvider: MusicProviderId = 'ambient';

  constructor() {
    const saved = localStorage.getItem('cosmos_active_music_provider');
    if (saved === 'spotify' || saved === 'ambient') this.activeProvider = saved;
  }

  getActiveProvider(): MusicProviderId { return this.activeProvider; }

  setActiveProvider(provider: MusicProviderId) {
    if (this.activeProvider === 'ambient') ambientAudio.stop();
    this.activeProvider = provider;
    localStorage.setItem('cosmos_active_music_provider', provider);
  }

  getCurrentPlaybackState(preset: Preset = 'forest'): ProviderPlaybackState {
    if (this.activeProvider !== 'ambient') {
      const name = 'Spotify';
      return { provider: this.activeProvider, isPlaying: false, currentTrack: `${name}: not connected`,
        artist: 'Authorization required', progressSeconds: 0, durationSeconds: 0, available: false };
    }
    return { provider: 'ambient', isPlaying: ambientAudio.getStatus().isPlaying, currentTrack: AMBIENT_TITLES[preset],
      artist: 'Cosmos ambient (generated in your browser)', progressSeconds: 0, durationSeconds: 0, available: true };
  }

  /** Returns false when the active provider cannot play, so callers never show a fake "playing" state. */
  play(preset: Preset = 'forest'): boolean {
    if (this.activeProvider !== 'ambient') return false;
    ambientAudio.play(preset);
    return true;
  }

  pause() { if (this.activeProvider === 'ambient') ambientAudio.stop(); }
  nextTrack() { /* ambient has no track list; external providers unavailable */ }
  prevTrack() { /* see nextTrack */ }

  openExternalApp() {
    if (this.activeProvider === 'spotify') window.open('https://open.spotify.com', '_blank', 'noopener,noreferrer');
  }
}

export const musicRegistry = new MusicAdapterRegistry();
