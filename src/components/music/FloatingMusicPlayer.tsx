import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
  Minimize2,
  Maximize2,
  Trees,
  CloudRain,
  Radio,
  Sparkles,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const FloatingMusicPlayer: React.FC = () => {
  const {
    musicState,
    setMusicState,
    toggleMusicPlayer,
    toggleMusicPlayback,
    setMusicVolume,
    setMusicPreset,
    switchMusicProvider,
    nextMusicTrack,
    prevMusicTrack,
    openExternalMusicApp,
    authorizeAppleMusic,
    setActiveModule,
  } = useApp();

  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(musicState.volume);

  if (!musicState.isOpen) return null;

  const handleMuteToggle = () => {
    if (isMuted) {
      setMusicVolume(prevVolume || 0.5);
      setIsMuted(false);
    } else {
      setPrevVolume(musicState.volume);
      setMusicVolume(0);
      setIsMuted(true);
    }
  };

  return (
    <div
      role="region"
      aria-label="Cosmos Mini-Player"
      className="fixed bottom-4 right-4 z-50 w-80 sm:w-88 rounded-2xl border border-[#DFE1D9] dark:border-[#383D35] bg-[#FFFFFF]/95 dark:bg-[#20231F]/95 shadow-2xl backdrop-blur-md transition-all duration-200"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#DFE1D9] dark:border-[#383D35] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              musicState.isPlaying ? 'bg-[#477653] dark:bg-[#91B594] animate-pulse' : 'bg-[#8A8E85]'
            }`}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7067] dark:text-[#A6AB9F]">
            {musicState.provider === 'ambient'
              ? 'Procedural Sound'
              : musicState.provider === 'spotify'
              ? 'Spotify Connect'
              : 'Apple MusicKit'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMusicState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))}
            aria-label={musicState.isMinimized ? 'Expand mini-player' : 'Minimize mini-player'}
            className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
          >
            {musicState.isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={toggleMusicPlayer}
            aria-label="Close mini-player"
            className="rounded p-1 text-[#8A8E85] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Provider-Aware Selector Tabs */}
      <div className="flex border-b border-[#DFE1D9] dark:border-[#383D35] bg-[#F5F5F0]/50 dark:bg-[#181A17]/50 p-1 text-[11px] font-semibold">
        <button
          onClick={() => switchMusicProvider('ambient')}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            musicState.provider === 'ambient'
              ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#3D5240] dark:text-[#A8BDA1] shadow-xs'
              : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821]'
          }`}
        >
          🌿 Ambient
        </button>
        <button
          onClick={() => switchMusicProvider('spotify')}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            musicState.provider === 'spotify'
              ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#1DB954] shadow-xs'
              : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821]'
          }`}
        >
          Spotify
        </button>
        <button
          onClick={() => switchMusicProvider('apple_music')}
          className={`flex-1 rounded-md py-1.5 transition-colors ${
            musicState.provider === 'apple_music'
              ? 'bg-[#FFFFFF] dark:bg-[#292D27] text-[#FA243C] shadow-xs'
              : 'text-[#6B7067] dark:text-[#A6AB9F] hover:text-[#252821]'
          }`}
        >
          Apple Music
        </button>
      </div>

      {!musicState.isMinimized && (
        <div className="p-4 space-y-3.5">
          {/* Ambient Presets if in ambient mode */}
          {musicState.provider === 'ambient' && (
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => setMusicPreset('forest')}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] font-medium transition-colors ${
                  musicState.ambientPreset === 'forest'
                    ? 'border-[#526B55] bg-[#E8EEE6] dark:bg-[#303B2E] text-[#526B55] dark:text-[#A8BDA1]'
                    : 'border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB]'
                }`}
              >
                <Trees className="h-4 w-4" />
                <span>Forest</span>
              </button>
              <button
                onClick={() => setMusicPreset('rain')}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] font-medium transition-colors ${
                  musicState.ambientPreset === 'rain'
                    ? 'border-[#526B55] bg-[#E8EEE6] dark:bg-[#303B2E] text-[#526B55] dark:text-[#A8BDA1]'
                    : 'border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB]'
                }`}
              >
                <CloudRain className="h-4 w-4" />
                <span>Rain</span>
              </button>
              <button
                onClick={() => setMusicPreset('alpha')}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] font-medium transition-colors ${
                  musicState.ambientPreset === 'alpha'
                    ? 'border-[#526B55] bg-[#E8EEE6] dark:bg-[#303B2E] text-[#526B55] dark:text-[#A8BDA1]'
                    : 'border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB]'
                }`}
              >
                <Radio className="h-4 w-4" />
                <span>Alpha</span>
              </button>
              <button
                onClick={() => setMusicPreset('celestial')}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] font-medium transition-colors ${
                  musicState.ambientPreset === 'celestial'
                    ? 'border-[#526B55] bg-[#E8EEE6] dark:bg-[#303B2E] text-[#526B55] dark:text-[#A8BDA1]'
                    : 'border-[#DFE1D9] dark:border-[#383D35] text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#F0F1EB]'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>432Hz</span>
              </button>
            </div>
          )}

          {/* Track details */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ECEDE7] dark:bg-[#292D27] text-[#526B55] dark:text-[#A8BDA1] font-bold shadow-xs">
              {musicState.provider === 'ambient' ? (
                <Trees className="h-5 w-5" />
              ) : musicState.provider === 'spotify' ? (
                <span className="text-[#1DB954] text-xs font-mono font-bold tracking-wider">SPOT</span>
              ) : (
                <span className="text-[#FA243C] text-xs font-mono font-bold tracking-wider">APPLE</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-[#252821] dark:text-[#ECEDE6]">
                {musicState.currentTrack}
              </div>
              <div className="truncate text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
                {musicState.artist}
              </div>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMuteToggle}
                aria-label="Toggle mute"
                className="p-1 text-[#8A8E85] hover:text-[#252821] dark:hover:text-[#ECEDE6]"
              >
                {isMuted || musicState.volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : musicState.volume}
                onChange={(e) => {
                  setIsMuted(false);
                  setMusicVolume(parseFloat(e.target.value));
                }}
                className="h-1 w-16 accent-[#3D5240] dark:accent-[#A8BDA1]"
                aria-label="Volume slider"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevMusicTrack}
                aria-label="Previous track"
                className="rounded-full p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                onClick={toggleMusicPlayback}
                aria-label={musicState.isPlaying ? 'Pause' : 'Play'}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3D5240] dark:bg-[#526B55] text-white shadow-md hover:bg-[#2E3F31] transition-transform active:scale-95"
              >
                {musicState.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>

              <button
                onClick={nextMusicTrack}
                aria-label="Next track"
                className="rounded-full p-1.5 text-[#6B7067] dark:text-[#A6AB9F] hover:bg-[#ECEDE7] dark:hover:bg-[#292D27] transition-colors"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Provider status & Deep Link launch */}
          {musicState.provider !== 'ambient' && (
            <div className="flex items-center justify-between rounded-xl bg-[#F5F5F0] dark:bg-[#181A17] p-2.5 text-[11px] text-[#6B7067] dark:text-[#A6AB9F]">
              <div className="flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-[#8A8E85]" />
                <span className="font-medium">
                  {musicState.externalStatus === 'ok' ? (musicState.provider === 'spotify' ? `Spotify${musicState.spotifyActiveDevice ? ` · ${musicState.spotifyActiveDevice}` : ''}` : 'Apple Music') : (musicState.externalMessage ?? (musicState.externalStatus === 'unknown' ? 'Checking connection…' : 'Not connected'))}
                </span>
              </div>
              {musicState.provider === 'apple_music' && musicState.externalStatus === 'not_authorized' && (
                <button onClick={() => void authorizeAppleMusic()} className="font-bold text-[#3D5240] dark:text-[#A8BDA1] hover:underline">Authorize</button>
              )}
              {musicState.provider === 'spotify' && musicState.externalStatus === 'not_connected' && (
                <button onClick={() => setActiveModule('settings')} className="font-bold text-[#3D5240] dark:text-[#A8BDA1] hover:underline">Connect in Settings</button>
              )}
              <a
                href={
                  musicState.provider === 'spotify'
                    ? 'https://open.spotify.com'
                    : 'https://music.apple.com'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-bold text-[#3D5240] dark:text-[#A8BDA1] hover:underline"
              >
                <span>Open {musicState.provider === 'spotify' ? 'Spotify' : 'Apple Music'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
