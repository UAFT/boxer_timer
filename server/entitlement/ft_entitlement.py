"""Fight Tech trial and subscription entitlement server (Google Play MVP).

One client call, POST /v1/entitlement, answers "may this device start a workout, and until when",
as a ticket signed with the server's ECDSA P-256 key. Trial dates come from this server's clock and
are keyed by HMAC(pepper, package|ANDROID_ID), so reinstalling or clearing app data keeps them.
Subscriptions are trusted only after Google Play Developer API says so (purchases.subscriptionsv2),
and acknowledged here. POST /v1/rtdn takes Real-time developer notifications through Pub/Sub push.

No secrets live in this file or in the repository: see deploy/README.md for the configuration.
Python 3.10 standard library plus google-auth, requests and cryptography.
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import sqlite3
import threading
import time
import urllib.parse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

DAY = 86400
TRIAL_DAYS = 14
TICKET_MAX_AGE = 7 * DAY          # a subscriber may train offline this long after the last check
RENEWAL_LEEWAY = 3 * DAY          # an auto-renewing subscription seen offline past its expiry
RECHECK_AFTER = 6 * 3600          # without RTDN, ask Google again when the stored state is older
DEVICE_RETENTION = 400 * DAY
PURCHASE_RETENTION = 90 * DAY     # after expiry
MAX_BODY = 16 * 1024

# subscriptionsv2 state -> ticket state; the first group grants access until expiry.
GRANTING = {'SUBSCRIPTION_STATE_ACTIVE': 'subscribed', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': 'grace',
            'SUBSCRIPTION_STATE_CANCELED': 'canceled'}
DENYING = {'SUBSCRIPTION_STATE_ON_HOLD': 'on_hold', 'SUBSCRIPTION_STATE_PAUSED': 'paused',
           'SUBSCRIPTION_STATE_PENDING': 'pending', 'SUBSCRIPTION_STATE_EXPIRED': 'expired',
           'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED': 'expired'}

log = logging.getLogger('ft_entitlement')

MIGRATIONS = [
    """
    CREATE TABLE devices(device_key TEXT PRIMARY KEY, weak INTEGER NOT NULL, trial_start INTEGER NOT NULL,
      trial_end INTEGER NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, checks INTEGER NOT NULL,
      integrity TEXT);
    CREATE TABLE purchases(token TEXT PRIMARY KEY, product_id TEXT, state TEXT, expiry_time INTEGER,
      auto_renew INTEGER, acknowledged INTEGER NOT NULL DEFAULT 0, voided INTEGER NOT NULL DEFAULT 0,
      superseded INTEGER NOT NULL DEFAULT 0, test INTEGER NOT NULL DEFAULT 0, checked_at INTEGER);
    CREATE TABLE bindings(token TEXT NOT NULL, device_key TEXT NOT NULL, first_seen INTEGER NOT NULL,
      PRIMARY KEY(token, device_key));
    CREATE TABLE rtdn_events(message_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
    """,
]


class ApiError(Exception):
    def __init__(self, status, code):
        super().__init__(code)
        self.status, self.code = status, code


class GoogleError(Exception):
    """Google could not be asked (network, 5xx, quota): keep what we know, do not grant anything new."""


class TokenRejected(Exception):
    """Google says the token is not a purchase of this app (400/404/410)."""


def b64u(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def b64u_decode(text):
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def rfc3339_seconds(value):
    # Google timestamps are UTC and may contain fractional seconds.
    fmt = '%Y-%m-%dT%H:%M:%S.%fZ' if isinstance(value, str) and '.' in value else '%Y-%m-%dT%H:%M:%SZ'
    return int(datetime.strptime(value, fmt).replace(tzinfo=timezone.utc).timestamp())


class Config:
    def __init__(self, env=os.environ):
        self.db = env.get('FT_DB', '/var/lib/ft-entitlement/ft.sqlite3')
        self.package = env.get('FT_PACKAGE', 'com.andarfighttech.boxertimer')
        # Product ID -> entitlements, owned by the server so the app hardcodes no product, price or market.
        self.products = json.loads(env.get('FT_PRODUCTS', '{}'))
        self.max_devices = int(env.get('FT_MAX_DEVICES_PER_PURCHASE', '5'))
        self.integrity_mode = env.get('FT_INTEGRITY_MODE', 'off')      # off | log | enforce
        self.cloud_project_number = env.get('FT_CLOUD_PROJECT_NUMBER', '')
        self.rtdn_audience = env.get('FT_RTDN_AUDIENCE', '')
        self.rtdn_email = env.get('FT_RTDN_SERVICE_ACCOUNT', '')
        self.bind = env.get('FT_BIND', '127.0.0.1:8805')
        self.pepper = _read_secret(env.get('FT_PEPPER_FILE', '/etc/ft-entitlement/pepper'))
        self.signing_key = serialization.load_pem_private_key(
            _read_secret(env.get('FT_SIGNING_KEY_FILE', '/etc/ft-entitlement/signing.pem')), None)
        self.google_key_file = env.get('FT_GOOGLE_SERVICE_ACCOUNT_FILE', '')
        assert self.integrity_mode in ('off', 'log', 'enforce'), self.integrity_mode


def _read_secret(path):
    with open(path, 'rb') as f:
        return f.read().strip()


class GooglePlay:
    """The two Google APIs, through a service account that only this server holds."""
    def __init__(self, cfg):
        from google.oauth2 import service_account
        from google.auth.transport.requests import AuthorizedSession
        creds = service_account.Credentials.from_service_account_file(cfg.google_key_file, scopes=[
            'https://www.googleapis.com/auth/androidpublisher', 'https://www.googleapis.com/auth/playintegrity'])
        self.http, self.package = AuthorizedSession(creds), cfg.package

    def _call(self, method, url, body=None):
        import requests
        try:
            r = self.http.request(method, url, json=body, timeout=15)
        except requests.RequestException as e:
            raise GoogleError(type(e).__name__)
        if r.status_code in (400, 404, 410):
            raise TokenRejected(r.status_code)
        if r.status_code >= 300:
            raise GoogleError(r.status_code)
        return r.json() if r.content else {}

    def subscription(self, token):
        return self._call('GET', 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'
                          f'{self.package}/purchases/subscriptionsv2/tokens/{urllib.parse.quote(token, safe="")}')

    def acknowledge(self, product_id, token):
        self._call('POST', 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'
                   f'{self.package}/purchases/subscriptions/{urllib.parse.quote(product_id, safe="")}'
                   f'/tokens/{urllib.parse.quote(token, safe="")}:acknowledge', {})

    def decode_integrity(self, integrity_token):
        return self._call('POST', f'https://playintegrity.googleapis.com/v1/{self.package}:decodeIntegrityToken',
                          {'integrity_token': integrity_token})


def connect(path):
    db = sqlite3.connect(path, timeout=10, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    migrate(db)
    return db


def migrate(db):
    # The metadata table is deliberately outside numbered migrations so a failed migration can
    # roll back completely while leaving only the version ledger behind.
    db.execute('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)')
    while True:
        db.execute('BEGIN IMMEDIATE')
        try:
            row = db.execute("SELECT value FROM meta WHERE key='schema'").fetchone()
            version = int(row[0]) if row else 0
            if version < 0 or version > len(MIGRATIONS):
                raise RuntimeError(f'unsupported schema version {version}')
            if version == len(MIGRATIONS):
                db.execute('COMMIT')
                return
            for statement in _sql_statements(MIGRATIONS[version]):
                db.execute(statement)
            db.execute("INSERT OR REPLACE INTO meta VALUES('schema', ?)", (str(version + 1),))
            db.execute('COMMIT')
        except Exception:
            if db.in_transaction:
                db.execute('ROLLBACK')
            raise


def _sql_statements(script):
    """Split a SQLite script without breaking quoted semicolons or trigger bodies."""
    pending = ''
    for char in script:
        pending += char
        if char == ';' and sqlite3.complete_statement(pending):
            if pending.strip():
                yield pending.strip()
            pending = ''
    if pending.strip():
        # sqlite3.complete_statement requires the final semicolon even though execute() does not.
        if not sqlite3.complete_statement(pending + ';'):
            raise ValueError('incomplete migration statement')
        yield pending.strip()


def integrity_nonce(install_id, android_id, first_open_ms):
    # The app computes the same value, so a token proves this request's identity and nothing else.
    return b64u(hashlib.sha256(f'{install_id}|{android_id}|{first_open_ms}'.encode()).digest())


def check_integrity(verdict, cfg, nonce):
    """Return '' when the token proves a genuine Play build on a genuine device, else the reason."""
    p = verdict.get('tokenPayloadExternal', verdict)
    req, app = p.get('requestDetails', {}), p.get('appIntegrity', {})
    if req.get('requestPackageName') != cfg.package: return 'package'
    if req.get('nonce') != nonce: return 'nonce'
    if app.get('appRecognitionVerdict') != 'PLAY_RECOGNIZED': return 'app'
    if 'MEETS_DEVICE_INTEGRITY' not in p.get('deviceIntegrity', {}).get('deviceRecognitionVerdict', []): return 'device'
    return ''


class Service:
    def __init__(self, cfg, google=None, verify_oidc=None, clock=time.time):
        self.cfg, self.google, self.clock = cfg, google, clock
        self.verify_oidc = verify_oidc or _verify_google_oidc
        self._pruned = 0
        self._lock = threading.Lock()

    def db(self):
        return connect(self.cfg.db)

    # ---------- identity and trial ----------
    def device_key(self, android_id, install_id):
        source = android_id if android_id else 'install:' + install_id
        return hmac.new(self.cfg.pepper, f'{self.cfg.package}|{source}'.encode(), hashlib.sha256).hexdigest(), not android_id

    def entitlement(self, body):
        now = int(self.clock())
        install_id, android_id = _str(body, 'installId', 64), _str(body, 'androidId', 64, required=False)
        if len(install_id) < 8: raise ApiError(400, 'installId')
        first_open = body.get('firstOpenAt')
        first_open_s = int(first_open) // 1000 if isinstance(first_open, (int, float)) and first_open > 0 else now
        key, weak = self.device_key(android_id, install_id)
        db = self.db()
        try:
            row = db.execute('SELECT * FROM devices WHERE device_key=?', (key,)).fetchone()
            if row is None:
                verdict = self._integrity(body, install_id, android_id, first_open)
                # The client may only move its own start earlier (to its first open), never later than our clock.
                start = max(min(now, first_open_s), now - TRIAL_DAYS * DAY)
                db.execute('INSERT OR IGNORE INTO devices VALUES(?,?,?,?,?,?,0,?)',
                           (key, int(weak), start, start + TRIAL_DAYS * DAY, now, now, verdict))
                row = db.execute('SELECT * FROM devices WHERE device_key=?', (key,)).fetchone()
                log.info('device new key=%s weak=%d integrity=%s', key[:10], weak, verdict)
            db.execute('UPDATE devices SET last_seen=?, checks=checks+1 WHERE device_key=?', (now, key))
            for p in (body.get('purchases') or [])[:5]:
                if isinstance(p, dict):
                    self._accept_purchase(db, key, _str(p, 'purchaseToken', 4096), _str(p, 'productId', 200), now)
            ticket = self._ticket(db, row, now)
        finally:
            db.close()
        self._maybe_prune(now)
        return {'ticket': ticket, 'products': sorted(self.cfg.products),
                'cloudProjectNumber': self.cfg.cloud_project_number, 'integrity': self.cfg.integrity_mode != 'off'}

    def _integrity(self, body, install_id, android_id, first_open):
        """Checked once, when a device is first seen. 'off': skipped; 'log': recorded; 'enforce': required."""
        mode = self.cfg.integrity_mode
        if mode == 'off': return None
        token = (body.get('integrity') or {}).get('token') if isinstance(body.get('integrity'), dict) else None
        reason = 'missing'
        if token and self.google:
            try:
                reason = check_integrity(self.google.decode_integrity(str(token)[:8192]), self.cfg,
                                         integrity_nonce(install_id, android_id, int(first_open or 0)))
            except (GoogleError, TokenRejected) as e:
                reason = 'unavailable' if isinstance(e, GoogleError) else 'invalid'
        if mode == 'enforce' and reason and reason != 'unavailable':
            raise ApiError(403, 'integrity_' + reason)
        return reason or 'ok'

    # ---------- purchases ----------
    def _accept_purchase(self, db, key, token, product_id, now):
        if product_id not in self.cfg.products: return
        if not self._refresh(db, token, now): return
        db.execute('INSERT OR IGNORE INTO bindings VALUES(?,?,?)', (token, key, now))

    def _refresh(self, db, token, now, force=False, strict=False):
        """Bring one token up to date with Google. False when Google rejects it or was never reachable.
        strict: re-raise GoogleError (RTDN must fail so that Pub/Sub delivers the notification again)."""
        row = db.execute('SELECT * FROM purchases WHERE token=?', (token,)).fetchone()
        if row and not force and row['checked_at'] and now - row['checked_at'] < RECHECK_AFTER: return True
        if not self.google: return bool(row)
        try:
            sub = self.google.subscription(token)
        except TokenRejected:
            db.execute('UPDATE purchases SET state=?, checked_at=? WHERE token=?', ('invalid', now, token))
            return False
        except GoogleError as e:
            log.warning('google unavailable: %s', e)
            if strict: raise
            return bool(row)
        items = [i for i in sub.get('lineItems', []) if i.get('productId') in self.cfg.products]
        if not items:
            return False
        item = max(items, key=lambda i: i.get('expiryTime', ''))
        expiry = rfc3339_seconds(item['expiryTime']) if item.get('expiryTime') else 0
        state = sub.get('subscriptionState', 'SUBSCRIPTION_STATE_UNSPECIFIED')
        acked = sub.get('acknowledgementState') == 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
        if not acked and state in ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'):
            try:
                self.google.acknowledge(item['productId'], token)
                acked = True
            except (GoogleError, TokenRejected) as e:
                log.warning('acknowledge failed, retried on next check: %s', e)
        db.execute("""INSERT INTO purchases(token, product_id, state, expiry_time, auto_renew, acknowledged, test, checked_at)
                      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET product_id=excluded.product_id,
                      state=excluded.state, expiry_time=excluded.expiry_time, auto_renew=excluded.auto_renew,
                      acknowledged=excluded.acknowledged, test=excluded.test, checked_at=excluded.checked_at""",
                   (token, item['productId'], state, expiry, int(bool(item.get('autoRenewingPlan', {}).get('autoRenewEnabled'))),
                    int(acked), int('testPurchase' in sub), now))
        old = sub.get('linkedPurchaseToken')
        if old and old != token:
            # Upgrade or resubscribe: the old token stops counting, its devices move to the new one.
            db.execute('UPDATE purchases SET superseded=1 WHERE token=?', (old,))
            db.execute('INSERT OR IGNORE INTO bindings SELECT ?, device_key, first_seen FROM bindings WHERE token=?', (token, old))
        return True

    def _ticket(self, db, device, now):
        best = None
        for p in db.execute("""SELECT p.*, b.first_seen FROM purchases p JOIN bindings b ON b.token=p.token
                               WHERE b.device_key=? AND p.superseded=0""", (device['device_key'],)).fetchall():
            if p['state'] != 'invalid' and self.google and now - (p['checked_at'] or 0) >= RECHECK_AFTER:
                self._refresh(db, p['token'], now)
                p = db.execute('SELECT p.*, ? AS first_seen FROM purchases p WHERE token=?', (p['first_seen'], p['token'])).fetchone()
            devices = db.execute('SELECT device_key FROM bindings WHERE token=? ORDER BY first_seen, device_key LIMIT ?',
                                 (p['token'], self.cfg.max_devices)).fetchall()
            if device['device_key'] not in [d[0] for d in devices]:
                continue                                    # one purchase, too many phones: this one is over the limit
            state, until = self._purchase_access(p, now)
            rank = (until > 0, until, p['expiry_time'] or 0)
            if best is None or rank > best[0]:
                best = (rank, state, until, self.cfg.products.get(p['product_id'], []))
        trial_end = device['trial_end']
        if best and best[2] > 0:
            state, until, ents = best[1], best[2], best[3]
        elif now < trial_end:
            state, until, ents = 'trial', trial_end, ['base']
        else:
            state, until, ents = (best[1] if best else 'trial_expired'), 0, []
        payload = {'v': 1, 'device': device['device_key'][:16], 'state': state, 'trialStart': device['trial_start'] * 1000,
                   'trialEnd': trial_end * 1000, 'accessUntil': until * 1000, 'entitlements': ents, 'issuedAt': now * 1000}
        return self.sign(payload)

    @staticmethod
    def _purchase_access(p, now):
        if p['voided']: return 'revoked', 0
        if p['state'] in GRANTING and (p['expiry_time'] or 0) > now:
            limit = p['expiry_time'] + (RENEWAL_LEEWAY if p['auto_renew'] and p['state'] != 'SUBSCRIPTION_STATE_CANCELED' else 0)
            return GRANTING[p['state']], min(now + TICKET_MAX_AGE, limit)
        if p['state'] in GRANTING: return 'expired', 0
        return DENYING.get(p['state'], 'expired'), 0

    def sign(self, payload):
        data = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()
        r, s = decode_dss_signature(self.cfg.signing_key.sign(data, ec.ECDSA(hashes.SHA256())))
        return {'payload': b64u(data), 'sig': b64u(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}

    # ---------- RTDN ----------
    def rtdn(self, body, authorization):
        claims = self.verify_oidc(authorization.removeprefix('Bearer ').strip(), self.cfg.rtdn_audience) if authorization.startswith('Bearer ') else None
        if not claims or claims.get('email') != self.cfg.rtdn_email or not claims.get('email_verified'):
            raise ApiError(401, 'unauthorized')
        msg = body.get('message') or {}
        message_id = _str(msg, 'messageId', 200)
        now = int(self.clock())
        db = self.db()
        try:
            if db.execute('SELECT 1 FROM rtdn_events WHERE message_id=?', (message_id,)).fetchone():
                return 'duplicate'
            note = json.loads(base64.b64decode(msg.get('data', '')) or b'{}')
            if note.get('packageName') != self.cfg.package:
                raise ApiError(400, 'package')
            if 'subscriptionNotification' in note:
                # A notification only says "something changed": the state is always read back from Google.
                token = note['subscriptionNotification'].get('purchaseToken', '')
                if self.google: self._refresh(db, token, now, force=True, strict=True)
            elif 'voidedPurchaseNotification' in note:
                token = note['voidedPurchaseNotification'].get('purchaseToken', '')
                db.execute('INSERT INTO purchases(token, voided, checked_at) VALUES(?,1,?) '
                           'ON CONFLICT(token) DO UPDATE SET voided=1', (token, now))
            db.execute('INSERT OR IGNORE INTO rtdn_events VALUES(?,?)', (message_id, now))
            return 'ok'
        finally:
            db.close()

    def _maybe_prune(self, now):
        if now - self._pruned < DAY or not self._lock.acquire(blocking=False): return
        try:
            self._pruned = now
            db = self.db()
            db.execute('DELETE FROM devices WHERE last_seen < ?', (now - DEVICE_RETENTION,))
            old = now - PURCHASE_RETENTION
            db.execute('DELETE FROM purchases WHERE COALESCE(expiry_time, 0) < ? AND COALESCE(checked_at, 0) < ?', (old, old))
            db.execute('DELETE FROM bindings WHERE token NOT IN (SELECT token FROM purchases) OR device_key NOT IN (SELECT device_key FROM devices)')
            db.execute('DELETE FROM rtdn_events WHERE received_at < ?', (now - 30 * DAY,))
            db.close()
        finally:
            self._lock.release()


def _str(obj, key, limit, required=True):
    value = obj.get(key) if isinstance(obj, dict) else None
    if value in (None, '') and not required: return ''
    if not isinstance(value, str) or not value or len(value) > limit: raise ApiError(400, key)
    return value


def _verify_google_oidc(token, audience):
    from google.oauth2 import id_token
    from google.auth.transport.requests import Request
    try:
        return id_token.verify_oauth2_token(token, Request(), audience=audience)
    except ValueError:
        return None


def make_handler(service):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'ft-entitlement'

        def _send(self, status, obj=None):
            data = json.dumps(obj).encode() if obj is not None else b''
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            # The app's WebView origin is https://localhost; no cookies or credentials, so any origin is safe.
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, GET')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Max-Age', '86400')
            self.send_header('Content-Length', '0')
            self.end_headers()

        def do_GET(self):
            self._send(200, {'ok': True}) if self.path == '/healthz' else self._send(404, {'error': 'not_found'})

        def do_POST(self):
            try:
                length = int(self.headers.get('Content-Length') or 0)
                if length <= 0 or length > MAX_BODY: raise ApiError(413, 'size')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict): raise ApiError(400, 'json')
                if self.path == '/v1/entitlement':
                    self._send(200, service.entitlement(body))
                elif self.path == '/v1/rtdn':
                    service.rtdn(body, self.headers.get('Authorization', ''))
                    self._send(204)
                else:
                    raise ApiError(404, 'not_found')
            except ApiError as e:
                self._send(e.status, {'error': e.code})
            except (ValueError, UnicodeDecodeError):
                self._send(400, {'error': 'json'})
            except Exception:
                log.exception('internal error')
                self._send(500, {'error': 'internal'})

        def log_message(self, fmt, *args):
            pass          # nginx keeps the access log; nothing here records IDs or tokens

    return Handler


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    cfg = Config()
    google = GooglePlay(cfg) if cfg.google_key_file else None
    if not google: log.warning('no Google service account: purchases cannot be verified, only trials are served')
    connect(cfg.db).close()
    host, port = cfg.bind.rsplit(':', 1)
    ThreadingHTTPServer((host, int(port)), make_handler(Service(cfg, google))).serve_forever()


if __name__ == '__main__':
    main()
