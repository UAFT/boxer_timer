import { AUDIO_FILE_MAP } from './catalog.js';

function createSilentBuffer(context) {
  const buffer = context.createBuffer(1, 1, context.sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  return source;
}

export class AudioEngine {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.masterGain = null;
    this.bufferCache = new Map();
    this.pendingLoads = new Map();
    this.missing = new Set();
    this.unlocked = false;
    this.activeNodes = new Set();
  }

  setEnabled(nextValue) {
    this.enabled = Boolean(nextValue);
  }

  getMissingAudioKeys() {
    return [...this.missing.values()];
  }

  ensureContext() {
    if (this.context) return this.context;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    this.context = new AudioContextCtor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.context.destination);
    return this.context;
  }

  async resumeContext() {
    const context = this.ensureContext();
    if (!context) return null;
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        return null;
      }
    }
    return context;
  }

  async preloadAll() {
    const keys = Object.keys(AUDIO_FILE_MAP);
    await Promise.allSettled(keys.map((key) => this.preload(key)));
  }

  async preload(key) {
    const src = AUDIO_FILE_MAP[key];
    if (!src) return null;
    if (this.bufferCache.has(key)) return this.bufferCache.get(key);
    if (this.pendingLoads.has(key)) return this.pendingLoads.get(key);

    const loader = (async () => {
      const context = this.ensureContext();
      if (!context) return null;
      try {
        const response = await fetch(src);
        if (!response.ok) {
          this.missing.add(key);
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
        this.bufferCache.set(key, decoded);
        return decoded;
      } catch {
        this.missing.add(key);
        return null;
      } finally {
        this.pendingLoads.delete(key);
      }
    })();

    this.pendingLoads.set(key, loader);
    return loader;
  }

  async unlock() {
    const context = await this.resumeContext();
    if (!context) return false;

    try {
      const silent = createSilentBuffer(context);
      silent.start(0);
    } catch {
      // no-op
    }

    this.unlocked = true;
    await this.preloadAll();
    return true;
  }

  stopAll() {
    for (const meta of [...this.activeNodes]) {
      this.stopMeta(meta);
    }
  }

  stopTag(tag) {
    if (!tag) return;
    for (const meta of [...this.activeNodes]) {
      if (meta.tag === tag) this.stopMeta(meta);
    }
  }

  stopMeta(meta) {
    if (!meta) return;
    try {
      meta.source.onended = null;
      meta.source.stop(0);
    } catch {
      // no-op
    }
    try {
      meta.source.disconnect();
    } catch {
      // no-op
    }
    try {
      meta.gain.disconnect();
    } catch {
      // no-op
    }
    this.activeNodes.delete(meta);
  }

  async play(key, { tag = 'cue', volume = 1 } = {}) {
    if (!this.enabled) return false;
    const context = await this.resumeContext();
    if (!context) return false;

    const buffer = await this.preload(key);
    if (!buffer || !this.masterGain) return false;

    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = Number.isFinite(volume) ? volume : 1;
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.masterGain);
      const meta = { source, gain, tag };
      source.onended = () => {
        this.activeNodes.delete(meta);
        try { source.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };
      this.activeNodes.add(meta);
      source.start(0);
      return true;
    } catch {
      return false;
    }
  }
}
