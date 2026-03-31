import { AUDIO_FILE_MAP } from './catalog.js';
import { AUDIO_KEYS } from '../core/constants.js';

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.cache = new Map();
    this.missing = new Set();
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

  async play(key) {
    if (!this.enabled) return false;
    const src = AUDIO_FILE_MAP[key];
    if (!src) return false;

    let baseAudio = this.cache.get(key);
    if (!baseAudio) {
      baseAudio = await this.preload(key);
    }

    if (!baseAudio) {
      return false;
    }

    try {
      const audio = baseAudio.cloneNode(true);
      audio.currentTime = 0;
      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  async playCountdown321() {
    await this.play(AUDIO_KEYS.COUNT_3);
    await wait(1000);
    await this.play(AUDIO_KEYS.COUNT_2);
    await wait(1000);
    await this.play(AUDIO_KEYS.COUNT_1);
  }
}
