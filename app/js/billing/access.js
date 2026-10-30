import { BILLING_CONFIG } from './config.js';

export const BILLING_STORAGE_KEY = 'ft.billing.v1';

const RETRY_DELAYS = Object.freeze([30e3, 2 * 60e3, 10 * 60e3]);
const SUBSCRIPTION_STATES = new Set(['subscribed', 'grace', 'canceled', 'cancelled']);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function decodeBase64(value, urlSafe = false) {
  if (typeof value !== 'string' || !value) throw new TypeError('Invalid base64 value');
  const invalidCharacter = urlSafe ? /[^A-Za-z0-9_-]/ : /[^A-Za-z0-9+/=]/;
  if (invalidCharacter.test(value)) throw new TypeError('Invalid base64 value');
  if (!urlSafe && value.includes('=') && !/^=+$/.test(value.slice(value.indexOf('=')))) {
    throw new TypeError('Invalid base64 value');
  }
  let normalized = urlSafe ? value.replace(/-/g, '+').replace(/_/g, '/') : value;
  while (normalized.endsWith('=')) normalized = normalized.slice(0, -1);
  if (normalized.length % 4 === 1) throw new TypeError('Invalid base64 value');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = globalThis.atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  let encoded = globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_');
  while (encoded.endsWith('=')) encoded = encoded.slice(0, -1);
  return encoded;
}

function randomInstallId(webCrypto) {
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  const source = webCrypto && typeof webCrypto.getRandomValues === 'function'
    ? webCrypto
    : globalThis.crypto;
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new Error('Secure randomness is unavailable');
  }
  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function freshRecord(clock, webCrypto) {
  const opened = finiteNumber(clock(), Date.now());
  return {
    installId: randomInstallId(webCrypto),
    firstOpenAt: opened,
    lastSeen: opened,
    ticket: null
  };
}

function normalizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (typeof value.installId !== 'string' || !value.installId) return null;
  if (!Number.isFinite(Number(value.firstOpenAt)) || !Number.isFinite(Number(value.lastSeen))) return null;
  if (value.ticket !== null && (typeof value.ticket !== 'object' || Array.isArray(value.ticket))) return null;
  const record = {
    installId: value.installId,
    firstOpenAt: Number(value.firstOpenAt),
    lastSeen: Number(value.lastSeen),
    ticket: value.ticket === null ? null : clone(value.ticket)
  };
  if (Array.isArray(value.products)) {
    record.products = value.products.filter((item) => typeof item === 'string' && item);
  }
  if (typeof value.cloudProjectNumber === 'string' || typeof value.cloudProjectNumber === 'number') {
    record.cloudProjectNumber = value.cloudProjectNumber;
  }
  if (typeof value.integrity === 'boolean') record.integrity = value.integrity;
  return record;
}

function loadRecord(storage, clock, webCrypto) {
  let parsed = null;
  try {
    const raw = storage.getItem(BILLING_STORAGE_KEY);
    parsed = raw === null ? null : normalizeRecord(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  return parsed || freshRecord(clock, webCrypto);
}

function frozenConfig(config) {
  const copy = { ...BILLING_CONFIG, ...(config || {}) };
  copy.ticketKeys = Object.freeze(Array.isArray(copy.ticketKeys) ? [...copy.ticketKeys] : []);
  return Object.freeze(copy);
}

function responseStatus(response) {
  const value = Number(response && response.status);
  return Number.isFinite(value) ? value : 0;
}

function isSuccessfulResponse(response, status) {
  if (typeof (response && response.ok) === 'boolean') return response.ok;
  return status >= 200 && status < 300;
}

/**
 * Creates the DOM-free billing access controller. Creation is asynchronous so a
 * persisted ticket is authenticated before decision() becomes available.
 */
export async function createBillingAccess(options = {}) {
  const storage = options.storage || globalThis.localStorage;
  const clock = typeof options.now === 'function' ? options.now : Date.now;
  const fetcher = options.fetch || globalThis.fetch;
  const webCrypto = options.crypto || globalThis.crypto;
  const subtle = webCrypto && webCrypto.subtle ? webCrypto.subtle : webCrypto;
  const plugin = options.plugin || null;
  const config = frozenConfig(options.config);
  const appVersion = typeof options.appVersion === 'string' ? options.appVersion : '';
  const timerSource = options.timers || globalThis;
  const setTimer = timerSource.setTimeout.bind(timerSource);
  const clearTimer = timerSource.clearTimeout.bind(timerSource);

  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('Billing storage is unavailable');
  }
  if (!subtle || typeof subtle.importKey !== 'function' || typeof subtle.verify !== 'function') {
    throw new TypeError('SubtleCrypto is unavailable');
  }

  let record = loadRecord(storage, clock, webCrypto);
  let verifiedPayload = null;
  let retryTimer = null;
  let disposed = false;
  const listeners = new Set();
  const importedKeys = new Map();

  function persist() {
    try {
      storage.setItem(BILLING_STORAGE_KEY, JSON.stringify(record));
      return true;
    } catch {
      return false;
    }
  }

  async function importTicketKey(spki) {
    if (!importedKeys.has(spki)) {
      const promise = subtle.importKey(
        'spki',
        decodeBase64(spki),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      ).catch(() => null);
      importedKeys.set(spki, promise);
    }
    return importedKeys.get(spki);
  }

  async function verifyTicket(ticket) {
    try {
      if (!ticket || typeof ticket !== 'object') return null;
      const payloadBytes = decodeBase64(ticket.payload, true);
      const signature = decodeBase64(ticket.sig, true);
      if (signature.byteLength !== 64) return null;
      const payload = JSON.parse(decoder.decode(payloadBytes));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.v !== 1) return null;
      for (const spki of config.ticketKeys) {
        const key = await importTicketKey(spki);
        if (!key) continue;
        try {
          if (await subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            key,
            signature,
            payloadBytes
          )) return payload;
        } catch {
          continue;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  verifiedPayload = await verifyTicket(record.ticket);
  if (record.ticket && !verifiedPayload) record.ticket = null;
  persist();

  function getRecord() {
    return clone(record);
  }

  function effectiveNow() {
    const current = finiteNumber(clock(), record.lastSeen);
    const issuedAt = finiteNumber(verifiedPayload && verifiedPayload.issuedAt, 0);
    const effective = Math.max(current, finiteNumber(record.lastSeen, 0), issuedAt);
    record.lastSeen = effective;
    persist();
    return effective;
  }

  function decision() {
    const current = effectiveNow();
    if (verifiedPayload) {
      const state = typeof verifiedPayload.state === 'string' ? verifiedPayload.state : 'expired';
      const accessUntil = finiteNumber(verifiedPayload.accessUntil, 0);
      const trialEnd = finiteNumber(verifiedPayload.trialEnd, 0);
      if (current < accessUntil) {
        return { allowed: true, reason: state, state, accessUntil, trialEnd, verified: true };
      }
      return {
        allowed: false,
        reason: state === 'trial'
          ? 'trial_expired'
          : (SUBSCRIPTION_STATES.has(state) ? 'ticket_stale' : state),
        state,
        accessUntil,
        trialEnd,
        verified: true
      };
    }

    const trialEnd = record.firstOpenAt + finiteNumber(config.trialMs, 0);
    const accessUntil = record.firstOpenAt + Math.min(
      finiteNumber(config.offlineUnverifiedMs, 0),
      finiteNumber(config.trialMs, 0)
    );
    const allowed = current < accessUntil;
    return {
      allowed,
      reason: allowed ? 'local_trial' : 'needs_network',
      state: 'local_trial',
      accessUntil,
      trialEnd,
      verified: false
    };
  }

  function canStart() {
    const current = decision();
    return config.enforce ? current.allowed : true;
  }

  function notify(result) {
    const event = Object.freeze({ ...result, decision: decision(), record: getRecord() });
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch {
        continue;
      }
    }
    return event;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Billing listener must be a function');
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  async function integrityNonce(androidId) {
    const source = record.installId + '|' + androidId + '|' + record.firstOpenAt;
    const digest = await subtle.digest('SHA-256', encoder.encode(source));
    return encodeBase64Url(new Uint8Array(digest));
  }

  async function purchaseTokens() {
    if (!plugin || typeof plugin.queryPurchases !== 'function') return [];
    try {
      const result = await plugin.queryPurchases();
      const values = Array.isArray(result && result.purchases) ? result.purchases : [];
      return values
        .filter((purchase) => purchase && purchase.purchaseState === 'PURCHASED')
        .map((purchase) => ({
          productId: typeof purchase.productId === 'string'
            ? purchase.productId
            : (Array.isArray(purchase.productIds) ? purchase.productIds[0] : ''),
          purchaseToken: typeof purchase.purchaseToken === 'string' ? purchase.purchaseToken : ''
        }))
        .filter((purchase) => purchase.productId && purchase.purchaseToken);
    } catch {
      return [];
    }
  }

  async function androidId() {
    if (!plugin || typeof plugin.deviceInfo !== 'function') return '';
    try {
      const info = await plugin.deviceInfo();
      return typeof (info && info.androidId) === 'string' ? info.androidId : '';
    } catch {
      return '';
    }
  }

  function cancelRetry() {
    if (retryTimer !== null) clearTimer(retryTimer);
    retryTimer = null;
  }

  function scheduleRetry(integrity, retryStep) {
    if (disposed || retryStep >= RETRY_DELAYS.length) return null;
    cancelRetry();
    const delay = RETRY_DELAYS[retryStep];
    retryTimer = setTimer(async () => {
      retryTimer = null;
      await performRefresh({ integrity }, retryStep + 1);
    }, delay);
    return delay;
  }

  function failedResult(kind, httpStatus, integrity, retryStep, error) {
    const retryIn = scheduleRetry(integrity, retryStep);
    return notify({
      type: 'refresh',
      ok: false,
      status: kind,
      httpStatus,
      retryIn,
      error: error instanceof Error ? error.message : undefined
    });
  }

  async function performRefresh({ integrity } = {}, retryStep = 0) {
    if (disposed) {
      return notify({ type: 'refresh', ok: false, status: 'disposed', httpStatus: 0, retryIn: null });
    }

    const deviceId = await androidId();
    const body = {
      installId: record.installId,
      androidId: deviceId,
      firstOpenAt: record.firstOpenAt,
      appVersion,
      purchases: await purchaseTokens()
    };
    const wantsIntegrity = !verifiedPayload && (integrity === true || record.integrity === true);
    if (wantsIntegrity && plugin && typeof plugin.integrityToken === 'function') {
      try {
        const nonce = await integrityNonce(deviceId);
        const result = await plugin.integrityToken({
          nonce,
          cloudProjectNumber: String(record.cloudProjectNumber || '')
        });
        if (result && typeof result.token === 'string' && result.token) {
          body.integrity = { token: result.token };
        }
      } catch {
        // no token: the server decides (log mode records "missing")
      }
    }

    let response;
    try {
      if (typeof fetcher !== 'function') throw new TypeError('Billing fetch is unavailable');
      response = await fetcher(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      return failedResult('network_error', 0, integrity, retryStep, error);
    }

    const httpStatus = responseStatus(response);
    if (!isSuccessfulResponse(response, httpStatus)) {
      if (httpStatus >= 500 || httpStatus === 0) {
        return failedResult('server_error', httpStatus, integrity, retryStep);
      }
      cancelRetry();
      return notify({ type: 'refresh', ok: false, status: 'client_error', httpStatus, retryIn: null });
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      return failedResult('invalid_response', httpStatus, integrity, retryStep, error);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return failedResult('invalid_response', httpStatus, integrity, retryStep);
    }

    if (Array.isArray(data.products)) {
      record.products = data.products.filter((item) => typeof item === 'string' && item);
    }
    if (typeof data.cloudProjectNumber === 'string' || typeof data.cloudProjectNumber === 'number') {
      record.cloudProjectNumber = data.cloudProjectNumber;
    }
    if (typeof data.integrity === 'boolean') record.integrity = data.integrity;

    const payload = await verifyTicket(data.ticket);
    if (payload) {
      record.ticket = clone(data.ticket);
      verifiedPayload = payload;
    }
    persist();
    cancelRetry();
    return notify({
      type: 'refresh',
      ok: Boolean(payload),
      status: payload ? 'updated' : 'invalid_ticket',
      httpStatus,
      retryIn: null
    });
  }

  async function refresh(refreshOptions = {}) {
    cancelRetry();
    return performRefresh(refreshOptions, 0);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelRetry();
    listeners.clear();
  }

  return Object.freeze({
    config,
    plugin,
    decision,
    canStart,
    refresh,
    verifyTicket,
    getRecord,
    subscribe,
    dispose
  });
}
