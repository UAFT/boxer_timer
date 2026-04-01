import { AUDIO_FILE_MAP } from './catalog.js';

export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.cache = new Map();
    this.missing = new Set();
    this.unlocked = false;
  }

  setEnabled(nextValue) {
    this.enabled = Boolean(nextValue);
  }

  getMissingAudioKeys() {
    return [...this.missing.values()];
  }

  async preloadAll() {
    const keys = Object.keys(AUDIO_FILE_MAP);
    await Promise.allSettled(keys.map((key) => this.preload(key)));
  }

  async preload(key) {
    const src = AUDIO_FILE_MAP[key];
    if (!src) return null;
    if (this.cache.has(key)) return this.cache.get(key);

    const audio = new Audio(src);
    audio.preload = 'auto';
    this.cache.set(key, audio);

    try {
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          cleanup();
          resolve(audio);
        };
        const onError = () => {
          cleanup();
          this.missing.add(key);
          reject(new Error(`Audio missing: ${key}`));
        };
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onCanPlay);
          audio.removeEventListener('error', onError);
        };

        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });
        audio.load();
      });
    } catch {
      return null;
    }

    return audio;
  }

  async unlock() {
    if (this.unlocked) return true;
    await this.preloadAll();
    const firstKey = Object.keys(AUDIO_FILE_MAP).find((key) => this.cache.has(key));
    if (!firstKey) {
      this.unlocked = true;
      return true;
    }

    const audio = this.cache.get(firstKey);
    if (!audio) return false;

    try {
      audio.muted = true;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      this.unlocked = true;
      return true;
    } catch {
      audio.muted = false;
      return false;
    }
  }

  async play(key) {
    if (!this.enabled) return false;
    const src = AUDIO_FILE_MAP[key];
    if (!src) return false;

    let baseAudio = this.cache.get(key);
    if (!baseAudio) {
      baseAudio = await this.preload(key);
    }

    if (!baseAudio) return false;

    try {
      const audio = baseAudio.cloneNode(true);
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }
}
