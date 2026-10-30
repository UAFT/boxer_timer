import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { createBillingAccess, BILLING_STORAGE_KEY } from '../app/js/billing/access.js';
import { BILLING_CONFIG } from '../app/js/billing/config.js';

// Trial/subscription gate on the device: only a server-signed ticket opens access beyond the
// short offline start, and neither the clock nor localStorage edits can extend it.
const DAY = 86400e3;
const T0 = Date.UTC(2026, 9, 30);
const subtle = webcrypto.subtle;
const b64u = bytes => Buffer.from(bytes).toString('base64url');

const keyPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const otherPair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const spki = Buffer.from(await subtle.exportKey('spki', keyPair.publicKey)).toString('base64');

async function sign(payload, key = keyPair.privateKey) {
  const data = Buffer.from(JSON.stringify({ v: 1, device: 'd', entitlements: ['base'], ...payload }));
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);   // WebCrypto: raw r||s, like the server
  return { payload: b64u(data), sig: b64u(sig) };
}

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), map };
}

function fakeTimers() {
  const pending = [];
  return { pending, setTimeout(fn, ms) { pending.push({ fn, ms }); return pending.length; }, clearTimeout() {} };
}

async function make({ now = T0, storage = memoryStorage(), fetch, plugin = null, enforce = true, timers = fakeTimers() } = {}) {
  const clock = { t: now };
  const access = await createBillingAccess({ storage, now: () => clock.t, fetch, plugin, timers, crypto: webcrypto,
    config: { ...BILLING_CONFIG, enforce, ticketKeys: [spki], endpoint: 'https://test/ft-api/v1/entitlement' } });
  return { access, clock, storage, timers };
}

const reply = (body, status = 200) => async () => ({ ok: status < 300, status, json: async () => body });

test('first open offline: allowed for 3 days, then the app needs the network once', async () => {
  const { access, clock } = await make();
  assert.equal(access.decision().reason, 'local_trial');
  assert.equal(access.canStart(), true);
  clock.t = T0 + 3 * DAY;
  assert.deepEqual([access.canStart(), access.decision().reason], [false, 'needs_network']);
});

test('server trial ticket allows until trialEnd, then trial_expired blocks', async () => {
  const ticket = await sign({ state: 'trial', trialStart: T0, trialEnd: T0 + 14 * DAY, accessUntil: T0 + 14 * DAY, issuedAt: T0 });
  const { access, clock } = await make({ fetch: reply({ ticket, products: ['fighttech_base'] }) });
  assert.equal((await access.refresh()).status, 'updated');
  clock.t = T0 + 13 * DAY;
  assert.equal(access.canStart(), true);
  clock.t = T0 + 14 * DAY;
  assert.deepEqual([access.canStart(), access.decision().reason], [false, 'trial_expired']);
  assert.deepEqual(access.getRecord().products, ['fighttech_base']);
});

test('forged, foreign-key and edited tickets never open access', async () => {
  const good = await sign({ state: 'subscribed', accessUntil: T0 + 7 * DAY, trialEnd: T0, issuedAt: T0 });
  const foreign = await sign({ state: 'subscribed', accessUntil: T0 + 7 * DAY, trialEnd: T0, issuedAt: T0 }, otherPair.privateKey);
  const edited = { ...good, payload: b64u(Buffer.from(JSON.stringify({ v: 1, state: 'subscribed', accessUntil: T0 + 999 * DAY, issuedAt: T0 }))) };
  for (const ticket of [foreign, edited, { payload: good.payload, sig: 'AAAA' }, null]) {
    const { access, clock } = await make({ fetch: reply({ ticket }) });
    assert.equal((await access.refresh()).status, 'invalid_ticket');
    clock.t = T0 + 4 * DAY;
    assert.equal(access.canStart(), false);
  }
  // Same thing written straight into localStorage: dropped on load.
  const storage = memoryStorage({ [BILLING_STORAGE_KEY]: JSON.stringify({ installId: 'i-1', firstOpenAt: T0, lastSeen: T0, ticket: edited }) });
  const { access } = await make({ storage, now: T0 + 4 * DAY });
  assert.equal(access.canStart(), false);
  assert.equal(JSON.parse(storage.getItem(BILLING_STORAGE_KEY)).ticket, null);
});

test('clock moved back after a check does not extend access', async () => {
  const ticket = await sign({ state: 'trial', trialEnd: T0 + 14 * DAY, accessUntil: T0 + 14 * DAY, issuedAt: T0 + 13 * DAY });
  const { access, clock } = await make({ now: T0 + 15 * DAY, fetch: reply({ ticket }) });
  await access.refresh();
  assert.equal(access.canStart(), false);
  clock.t = T0 + 10 * DAY;                         // user sets the phone back
  assert.equal(access.canStart(), false);
  assert.equal(access.getRecord().lastSeen, T0 + 15 * DAY);
});

// Owner 2026-10-30: a paid ticket works offline at most 24 h after the server's last Google check
// and never past the paid-through date (both already folded into accessUntil by the server).
const HOUR = 3600e3;
const paid = (extra = {}) => sign({ state: 'subscribed', trialEnd: T0 - DAY, accessUntil: T0 + 24 * HOUR,
  paidUntil: T0 + 20 * DAY, issuedAt: T0, ...extra });

test('subscriber offline: 23 h allowed, 25 h stale; the card date is the paid-through date', async () => {
  const { access, clock } = await make({ fetch: reply({ ticket: await paid() }) });
  await access.refresh();
  clock.t = T0 + 23 * HOUR;
  assert.equal(access.canStart(), true);
  assert.equal(access.decision().paidUntil, T0 + 20 * DAY);
  clock.t = T0 + 25 * HOUR;
  assert.deepEqual([access.canStart(), access.decision().reason], [false, 'ticket_stale']);
});

test('paid-through boundary: access ends at paidUntil even inside the 24 h window', async () => {
  const ticket = await paid({ accessUntil: T0 + 10 * HOUR, paidUntil: T0 + 10 * HOUR });
  const { access, clock } = await make({ fetch: reply({ ticket }) });
  await access.refresh();
  clock.t = T0 + 10 * HOUR - 1;
  assert.equal(access.canStart(), true);
  clock.t = T0 + 10 * HOUR;
  assert.equal(access.canStart(), false);
});

test('cancel keeps the paid period; refund, revocation, expiry and unverified stop at the next check', async () => {
  let ticket = await paid({ state: 'canceled' });
  const fetch = async () => ({ ok: true, status: 200, json: async () => ({ ticket }) });
  const { access, clock } = await make({ fetch });
  await access.refresh();
  assert.deepEqual([access.canStart(), access.decision().state], [true, 'canceled']);
  for (const state of ['revoked', 'expired', 'unverified', 'on_hold']) {
    clock.t += HOUR;
    ticket = await sign({ state, trialEnd: T0 - DAY, accessUntil: 0, paidUntil: 0, issuedAt: clock.t });
    await access.refresh();
    assert.deepEqual([access.canStart(), access.decision().reason], [false, state]);
  }
});

test('offline paid access is not extended by clock rollback, a new install or a re-signed copy', async () => {
  const storage = memoryStorage();
  const { access, clock } = await make({ storage, fetch: reply({ ticket: await paid() }) });
  await access.refresh();
  clock.t = T0 + 25 * HOUR;
  assert.equal(access.canStart(), false);
  clock.t = T0 + HOUR;                                      // phone clock set back
  assert.equal(access.canStart(), false);
  const forged = await paid({ accessUntil: T0 + 99 * DAY });
  const edited = JSON.parse(storage.getItem(BILLING_STORAGE_KEY));
  edited.ticket = { ...edited.ticket, payload: forged.payload };         // valid payload, old signature
  storage.setItem(BILLING_STORAGE_KEY, JSON.stringify(edited));
  const again = await make({ storage, now: T0 + HOUR });
  assert.equal(again.access.canStart(), false);
  const fresh = await make({ now: T0 + 25 * HOUR });         // reinstall: no ticket, first open now
  assert.equal(fresh.access.decision().reason, 'local_trial');          // the trial contract, decided by the server on first contact
});

test('network recovery revalidates and replaces the stale ticket at once', async () => {
  let online = false;
  const fetch = async () => {
    if (!online) throw new TypeError('offline');
    return { ok: true, status: 200, json: async () => ({ ticket: await paid({ accessUntil: T0 + 50 * HOUR, issuedAt: T0 + 26 * HOUR }) }) };
  };
  const first = await paid();
  const storage = memoryStorage({ [BILLING_STORAGE_KEY]: JSON.stringify({ installId: 'i-0001', firstOpenAt: T0 - 20 * DAY, lastSeen: T0, ticket: first }) });
  const { access } = await make({ storage, fetch, now: T0 + 26 * HOUR });
  assert.equal(access.canStart(), false);
  online = true;
  assert.equal((await access.refresh()).status, 'updated');
  assert.equal(access.canStart(), true);
});

test('an unusable clock fails closed', async () => {
  const { access, clock } = await make();
  clock.t = NaN;
  assert.deepEqual([access.canStart(), access.decision().reason], [false, 'clock_unavailable']);
});

test('network and 5xx errors keep the ticket and retry 30 s, 2 min, 10 min; 4xx does not retry', async () => {
  const ticket = await sign({ state: 'trial', trialEnd: T0 + 14 * DAY, accessUntil: T0 + 14 * DAY, issuedAt: T0 });
  let mode = 'ok';
  const fetch = async () => {
    if (mode === 'down') throw new TypeError('offline');
    if (mode === '500') return { ok: false, status: 503, json: async () => ({}) };
    if (mode === '400') return { ok: false, status: 400, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ ticket }) };
  };
  const { access, timers, clock } = await make({ fetch });
  await access.refresh();
  mode = 'down';
  const first = await access.refresh();
  assert.deepEqual([first.status, first.retryIn], ['network_error', 30e3]);
  mode = '500';
  await timers.pending.at(-1).fn();
  await timers.pending.at(-1).fn();
  assert.deepEqual(timers.pending.map(t => t.ms), [30e3, 2 * 60e3, 10 * 60e3]);
  await timers.pending.at(-1).fn();
  assert.equal(timers.pending.length, 3);           // gives up after the third retry
  clock.t = T0 + 5 * DAY;
  assert.equal(access.canStart(), true);            // old ticket still valid
  mode = '400';
  const client = await access.refresh();
  assert.deepEqual([client.status, client.retryIn], ['client_error', null]);
});

test('enforce:false never blocks a start but still computes the decision', async () => {
  const { access, clock } = await make({ enforce: false });
  clock.t = T0 + 30 * DAY;
  assert.deepEqual([access.canStart(), access.decision().allowed], [true, false]);
});

test('refresh sends only PURCHASED tokens, the device ID and the integrity nonce of the server formula', async () => {
  let sent = null;
  const fetch = async (url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ integrity: true, cloudProjectNumber: '42' }) }; };
  let integrityArgs = null;
  const plugin = {
    deviceInfo: async () => ({ androidId: 'a1b2c3d4e5f60718' }),
    queryPurchases: async () => ({ responseCode: 'OK', purchases: [
      { productId: 'fighttech_base', purchaseToken: 'paid', purchaseState: 'PURCHASED' },
      { productId: 'fighttech_base', purchaseToken: 'wait', purchaseState: 'PENDING' }] }),
    integrityToken: async args => { integrityArgs = args; return { token: 'itok' }; }
  };
  const { access } = await make({ fetch, plugin });
  await access.refresh();
  assert.deepEqual(sent.purchases, [{ productId: 'fighttech_base', purchaseToken: 'paid' }]);
  assert.equal(sent.androidId, 'a1b2c3d4e5f60718');
  assert.equal(sent.integrity, undefined);          // the first answer tells whether integrity is wanted
  await access.refresh();
  const { installId, firstOpenAt } = access.getRecord();
  const expected = createHash('sha256').update(`${installId}|a1b2c3d4e5f60718|${firstOpenAt}`).digest('base64url');
  assert.deepEqual(integrityArgs, { nonce: expected, cloudProjectNumber: '42' });
  assert.deepEqual(sent.integrity, { token: 'itok' });
});

test('a corrupt record is recreated without touching the other app data', async () => {
  const storage = memoryStorage({ [BILLING_STORAGE_KEY]: '{not json', 'boxer-timer-programs': '[1,2,3]' });
  const { access } = await make({ storage });
  assert.ok(access.getRecord().installId.length >= 16);
  assert.equal(storage.getItem('boxer-timer-programs'), '[1,2,3]');
});

test('the shipped config keeps blocking off and holds the server public key', () => {
  assert.equal(BILLING_CONFIG.enforce, false);
  assert.equal(BILLING_CONFIG.ticketKeys.length, 1);
  assert.match(BILLING_CONFIG.endpoint, /^https:\/\/andarfighttech\.com\/ft-api\//);
});
