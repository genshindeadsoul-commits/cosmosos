// Procedural ambient sound synthesis using Web Audio API
// 100% offline, privacy-preserving, zero copyright risk, and soothing for focus

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isRunning: boolean = false;
  private currentPreset: string = 'forest';
  private nodes: AudioNode[] = [];

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val * 0.4)), this.ctx.currentTime, 0.1);
    }
  }

  public play(preset: 'forest' | 'rain' | 'alpha' | 'celestial' = 'forest') {
    this.initContext();
    this.stop();
    if (!this.ctx || !this.masterGain) return;

    this.isRunning = true;
    this.currentPreset = preset;

    if (preset === 'forest' || preset === 'rain') {
      // Noise buffer for rain/forest breeze
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Pink-ish noise filter
        lastOut = (lastOut * 0.95) + (white * 0.05);
        data[i] = lastOut * (preset === 'rain' ? 3.5 : 2.0);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = preset === 'rain' ? 'lowpass' : 'bandpass';
      filter.frequency.setValueAtTime(preset === 'rain' ? 650 : 380, this.ctx.currentTime);
      filter.Q.setValueAtTime(preset === 'rain' ? 0.8 : 1.4, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start();
      this.nodes.push(noise, filter, gain);
    } else {
      // Harmonic sine drones (Alpha / Celestial 432Hz)
      const baseFreq = preset === 'alpha' ? 216 : 144;
      const freqs = [baseFreq, baseFreq * 1.5, baseFreq * 2];

      freqs.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq + (idx * 0.5), this.ctx.currentTime);
        oscGain.gain.setValueAtTime(0.12 / (idx + 1), this.ctx.currentTime);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start();
        this.nodes.push(osc, oscGain);
      });
    }
  }

  public stop() {
    this.nodes.forEach((n) => {
      try {
        if ('stop' in n && typeof (n as any).stop === 'function') {
          (n as any).stop();
        }
        n.disconnect();
      } catch {
        // ignore disconnect errors
      }
    });
    this.nodes = [];
    this.isRunning = false;
  }

  public getStatus() {
    return {
      isPlaying: this.isRunning,
      preset: this.currentPreset,
    };
  }
}

export const ambientAudio = new AmbientAudioEngine();
