"""Tests for ft_entitlement: python3 -m unittest -v (from this directory). Google and OIDC are fakes."""
import base64
import io
import json
import logging
import os
import sqlite3
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature

import ft_entitlement as fe

DAY = 86400
T0 = 1793318400            # 2026-10-30 00:00 UTC
ANDROID_ID = '9774d56d682e549c'
PRODUCT = 'fighttech_base'


def iso(ts):
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%fZ')


class FakeGoogle:
    def __init__(self):
        self.subs, self.acks, self.calls, self.down, self.ack_down = {}, [], 0, False, False
        self.integrity = {}

    def subscription(self, token):
        self.calls += 1
        if self.down: raise fe.GoogleError('down')
        if token not in self.subs: raise fe.TokenRejected(404)
        return self.subs[token]

    def acknowledge(self, product_id, token):
        if self.ack_down: raise fe.GoogleError('down')
        self.acks.append((product_id, token))
        self.subs[token]['acknowledgementState'] = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'

    def decode_integrity(self, token):
        if self.down: raise fe.GoogleError('down')
        if token not in self.integrity: raise fe.TokenRejected(400)
        return self.integrity[token]

    def sub(self, token, state='SUBSCRIPTION_STATE_ACTIVE', expiry=T0 + 30 * DAY, auto=True, acked=False, linked=None):
        self.subs[token] = {'subscriptionState': state, 'acknowledgementState':
                            'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' if acked else 'ACKNOWLEDGEMENT_STATE_PENDING',
                            'lineItems': [{'productId': PRODUCT, 'expiryTime': iso(expiry),
                                           'autoRenewingPlan': {'autoRenewEnabled': auto}}]}
        if linked: self.subs[token]['linkedPurchaseToken'] = linked


class Clock:
    def __init__(self, t=T0): self.t = t
    def __call__(self): return self.t


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        d = self.dir.name
        key = ec.generate_private_key(ec.SECP256R1())
        self.public = key.public_key()
        with open(f'{d}/signing.pem', 'wb') as f:
            f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        with open(f'{d}/pepper', 'w') as f: f.write('test-pepper')
        self.env = {'FT_DB': f'{d}/ft.sqlite3', 'FT_PEPPER_FILE': f'{d}/pepper', 'FT_SIGNING_KEY_FILE': f'{d}/signing.pem',
                    'FT_PRODUCTS': json.dumps({PRODUCT: ['base']}), 'FT_RTDN_AUDIENCE': 'aud',
                    'FT_RTDN_SERVICE_ACCOUNT': 'rtdn@x.iam.gserviceaccount.com'}
        self.google, self.clock = FakeGoogle(), Clock()
        self.make()

    def make(self, **env):
        self.cfg = fe.Config({**self.env, **env})
        self.svc = fe.Service(self.cfg, self.google, verify_oidc=self.oidc, clock=self.clock)

    @staticmethod
    def oidc(token, audience):
        return {'email': 'rtdn@x.iam.gserviceaccount.com', 'email_verified': True} if token == 'good' and audience == 'aud' else None

    def tearDown(self):
        self.dir.cleanup()

    def call(self, install='install-0001', android=ANDROID_ID, first_open=None, purchases=(), **extra):
        body = {'installId': install, 'androidId': android, 'firstOpenAt': first_open if first_open is not None else T0 * 1000,
                'purchases': [{'productId': PRODUCT, 'purchaseToken': t} for t in purchases], **extra}
        return self.ticket(self.svc.entitlement(body))

    def ticket(self, response):
        t = response['ticket']
        data, sig = fe.b64u_decode(t['payload']), fe.b64u_decode(t['sig'])
        self.assertEqual(len(sig), 64)
        der = encode_dss_signature(int.from_bytes(sig[:32], 'big'), int.from_bytes(sig[32:], 'big'))
        self.public.verify(der, data, ec.ECDSA(hashes.SHA256()))       # raises if the signature is wrong
        payload = json.loads(data)
        self.assertEqual(sorted(payload), ['accessUntil', 'device', 'entitlements', 'issuedAt', 'state', 'trialEnd', 'trialStart', 'v'])
        return payload

    def rtdn(self, note, message_id='m1', auth='Bearer good'):
        data = base64.b64encode(json.dumps({'packageName': self.cfg.package, **note}).encode()).decode()
        return self.svc.rtdn({'message': {'data': data, 'messageId': message_id}}, auth)


class TrialTests(Base):
    def test_first_open_gets_14_days_from_server_clock(self):
        p = self.call()
        self.assertEqual((p['state'], p['trialStart'], p['trialEnd'], p['accessUntil']),
                         ('trial', T0 * 1000, (T0 + 14 * DAY) * 1000, (T0 + 14 * DAY) * 1000))
        self.assertEqual(p['entitlements'], ['base'])

    def test_reinstall_and_cleared_data_keep_the_dates(self):
        self.call(first_open=T0 * 1000)
        self.clock.t += 5 * DAY
        p = self.call(install='install-9999', first_open=self.clock.t * 1000)
        self.assertEqual(p['trialEnd'], (T0 + 14 * DAY) * 1000)

    def test_offline_first_open_counts_from_the_first_open(self):
        self.clock.t = T0 + 2 * DAY
        self.assertEqual(self.call(first_open=T0 * 1000)['trialEnd'], (T0 + 14 * DAY) * 1000)

    def test_future_first_open_does_not_move_the_trial_later(self):
        self.assertEqual(self.call(first_open=(T0 + 100 * DAY) * 1000)['trialStart'], T0 * 1000)

    def test_ancient_first_open_is_clamped_to_one_trial_back(self):
        self.assertEqual(self.call(first_open=1000)['state'], 'trial_expired')

    def test_day_15_expired_and_clock_on_server_only(self):
        self.call()
        self.clock.t += 14 * DAY
        p = self.call(first_open=self.clock.t * 1000)
        self.assertEqual((p['state'], p['accessUntil'], p['entitlements']), ('trial_expired', 0, []))

    def test_no_android_id_falls_back_to_install_id_marked_weak(self):
        self.call(android='')
        db = sqlite3.connect(self.cfg.db)
        self.assertEqual(db.execute('SELECT weak FROM devices').fetchall(), [(1,)])
        self.clock.t += DAY
        self.assertEqual(self.call(android='', install='install-0002', first_open=self.clock.t * 1000)['trialStart'], self.clock.t * 1000)

    def test_raw_android_id_never_stored_or_logged(self):
        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        fe.log.addHandler(handler); fe.log.setLevel(logging.DEBUG)
        try:
            self.call()
        finally:
            fe.log.removeHandler(handler)
        self.assertNotIn(ANDROID_ID, stream.getvalue())
        for name in os.listdir(self.dir.name):
            with open(os.path.join(self.dir.name, name), 'rb') as f:
                self.assertNotIn(ANDROID_ID.encode(), f.read(), name)

    def test_bad_input(self):
        for body in ({}, {'installId': 'short'}, {'installId': 'x' * 65}, {'installId': 'install-1', 'androidId': 5}):
            with self.assertRaises(fe.ApiError) as e: self.svc.entitlement(body)
            self.assertEqual(e.exception.status, 400)

    def test_migrations_idempotent(self):
        self.call()
        for _ in range(2): fe.connect(self.cfg.db).close()
        db = sqlite3.connect(self.cfg.db)
        self.assertEqual(db.execute("SELECT value FROM meta WHERE key='schema'").fetchone()[0], str(len(fe.MIGRATIONS)))
        self.assertEqual(db.execute('SELECT COUNT(*) FROM devices').fetchone()[0], 1)

    def test_rfc3339(self):
        self.assertEqual(fe.rfc3339_seconds('2026-10-30T00:00:00Z'), T0)
        self.assertEqual(fe.rfc3339_seconds('2026-10-30T00:00:00.123456Z'), T0)


class PurchaseTests(Base):
    def test_active_subscription_unlocks_and_is_acknowledged_once(self):
        self.google.sub('tok')
        self.clock.t += 20 * DAY
        p = self.call(purchases=['tok'])
        self.assertEqual((p['state'], p['entitlements']), ('subscribed', ['base']))
        self.assertEqual(p['accessUntil'], (self.clock.t + 7 * DAY) * 1000)       # ticket age cap
        self.clock.t += 7 * 3600
        self.call(purchases=['tok'])
        self.assertEqual(self.google.acks, [(PRODUCT, 'tok')])

    def test_access_until_caps(self):
        self.google.sub('auto', expiry=T0 + 2 * DAY, auto=True, acked=True)
        self.assertEqual(self.call(purchases=['auto'])['accessUntil'], (T0 + 5 * DAY) * 1000)   # expiry + 3 days
        self.google.sub('noauto', expiry=T0 + 2 * DAY, auto=False, acked=True)
        self.assertEqual(self.call(install='install-0002', android='b' * 16, purchases=['noauto'])['accessUntil'], (T0 + 2 * DAY) * 1000)

    def test_unknown_product_and_unconfirmed_tokens_never_grant(self):
        self.clock.t += 20 * DAY
        r = self.svc.entitlement({'installId': 'install-0001', 'androidId': ANDROID_ID, 'firstOpenAt': 1,
                                  'purchases': [{'productId': 'other', 'purchaseToken': 'tok'}]})
        self.assertEqual(self.ticket(r)['state'], 'trial_expired')
        self.assertEqual(self.call(purchases=['forged'])['state'], 'trial_expired')        # Google: 404
        self.google.down = True
        self.google.sub('new')
        self.assertEqual(self.call(purchases=['new'])['state'], 'trial_expired')            # Google down: not confirmed

    def test_google_down_keeps_known_state_and_ack_failure_still_grants(self):
        self.google.ack_down = True
        self.google.sub('tok')
        self.clock.t += 20 * DAY
        self.assertEqual(self.call(purchases=['tok'])['state'], 'subscribed')
        self.assertEqual(self.google.acks, [])
        self.google.ack_down, self.google.down = False, True
        self.clock.t += 7 * 3600
        self.assertEqual(self.call(purchases=['tok'])['state'], 'subscribed')
        self.google.down = False
        self.clock.t += 7 * 3600
        self.call()                                    # no token sent: the binding is enough, recheck acknowledges
        self.assertEqual(self.google.acks, [(PRODUCT, 'tok')])

    def test_state_table(self):
        cases = {'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': 'grace', 'SUBSCRIPTION_STATE_CANCELED': 'canceled',
                 'SUBSCRIPTION_STATE_ON_HOLD': 'on_hold', 'SUBSCRIPTION_STATE_PAUSED': 'paused',
                 'SUBSCRIPTION_STATE_PENDING': 'pending', 'SUBSCRIPTION_STATE_EXPIRED': 'expired',
                 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED': 'expired'}
        self.clock.t += 20 * DAY
        for n, (state, expected) in enumerate(cases.items()):
            self.google.sub(f't{n}', state=state, acked=True)
            p = self.call(install=f'install-{n:04}', android=f'{n:016}', purchases=[f't{n}'])
            self.assertEqual(p['state'], expected, state)
            self.assertEqual(p['accessUntil'] > 0, expected in ('grace', 'canceled'), state)
        self.google.sub('old', state='SUBSCRIPTION_STATE_CANCELED', expiry=self.clock.t - 1, acked=True)
        self.assertEqual(self.call(install='install-old1', android='e' * 16, purchases=['old'])['state'], 'expired')
        self.assertEqual(self.google.acks, [])       # only ACTIVE/GRACE are acknowledged, and these came acknowledged

    def test_cancel_keeps_access_until_expiry_then_blocks(self):
        self.google.sub('tok', acked=True, expiry=T0 + 30 * DAY)
        self.clock.t += 20 * DAY
        self.call(purchases=['tok'])
        self.google.sub('tok', state='SUBSCRIPTION_STATE_CANCELED', acked=True, expiry=T0 + 30 * DAY, auto=False)
        self.assertEqual(self.rtdn({'subscriptionNotification': {'notificationType': 3, 'purchaseToken': 'tok'}}), 'ok')
        p = self.call()
        self.assertEqual((p['state'], p['accessUntil']), ('canceled', (T0 + 27 * DAY) * 1000))
        self.clock.t = T0 + 31 * DAY
        self.google.sub('tok', state='SUBSCRIPTION_STATE_EXPIRED', acked=True, expiry=T0 + 30 * DAY, auto=False)
        self.assertEqual(self.call()['state'], 'expired')

    def test_refund_voided_revokes(self):
        self.google.sub('tok', acked=True)
        self.clock.t += 20 * DAY
        self.call(purchases=['tok'])
        self.rtdn({'voidedPurchaseNotification': {'purchaseToken': 'tok', 'productType': 1, 'refundType': 1}})
        self.assertEqual(self.call(purchases=['tok'])['state'], 'revoked')

    def test_voided_before_first_seen_still_revokes(self):
        self.rtdn({'voidedPurchaseNotification': {'purchaseToken': 'tok', 'productType': 1, 'refundType': 1}})
        self.google.sub('tok', acked=True)
        self.clock.t += 20 * DAY
        self.assertEqual(self.call(purchases=['tok'])['state'], 'revoked')

    def test_linked_token_supersedes_and_moves_devices(self):
        self.google.sub('old', acked=True)
        self.clock.t += 20 * DAY
        self.call(purchases=['old'])
        self.google.sub('old', state='SUBSCRIPTION_STATE_EXPIRED', acked=True)
        self.google.sub('new', acked=True, linked='old')
        self.rtdn({'subscriptionNotification': {'notificationType': 4, 'purchaseToken': 'new'}})
        self.assertEqual(self.call()['state'], 'subscribed')        # device carried to the new token
        db = sqlite3.connect(self.cfg.db)
        self.assertEqual(db.execute("SELECT superseded FROM purchases WHERE token='old'").fetchone()[0], 1)

    def test_five_devices_per_purchase(self):
        self.google.sub('tok', acked=True)
        self.clock.t += 20 * DAY
        states = [self.call(install=f'install-{n:04}', android=f'{n:016}', purchases=['tok'])['state'] for n in range(6)]
        self.assertEqual(states, ['subscribed'] * 5 + ['trial_expired'])
        self.assertEqual(self.call(install='install-0000', android=f'{0:016}')['state'], 'subscribed')

    def test_stale_state_is_rechecked_after_6_hours(self):
        self.google.sub('tok', acked=True)
        self.call(purchases=['tok'])
        calls = self.google.calls
        self.clock.t += 3600
        self.call(purchases=['tok'])
        self.assertEqual(self.google.calls, calls)
        self.clock.t += 6 * 3600
        self.call(purchases=['tok'])
        self.assertEqual(self.google.calls, calls + 1)

    def test_subscriber_offline_ticket_is_capped(self):
        self.google.sub('tok', acked=True, expiry=T0 + 60 * DAY)
        p = self.call(purchases=['tok'])
        self.assertEqual(p['accessUntil'], (T0 + 7 * DAY) * 1000)


class IntegrityTests(Base):
    def verdict(self, nonce, app='PLAY_RECOGNIZED', device=('MEETS_DEVICE_INTEGRITY',)):
        return {'tokenPayloadExternal': {'requestDetails': {'requestPackageName': self.cfg.package, 'nonce': nonce},
                                         'appIntegrity': {'appRecognitionVerdict': app},
                                         'deviceIntegrity': {'deviceRecognitionVerdict': list(device)}}}

    def test_enforce(self):
        self.make(FT_INTEGRITY_MODE='enforce')
        first = T0 * 1000
        nonce = fe.integrity_nonce('install-0001', ANDROID_ID, first)
        for token, verdict, reason in (('bad', None, 'integrity_invalid'), ('app', self.verdict(nonce, app='UNRECOGNIZED_VERSION'), 'integrity_app'),
                                       ('nonce', self.verdict('other'), 'integrity_nonce'), ('dev', self.verdict(nonce, device=()), 'integrity_device')):
            if verdict: self.google.integrity[token] = verdict
            with self.assertRaises(fe.ApiError) as e: self.call(first_open=first, integrity={'token': token})
            self.assertEqual((e.exception.status, e.exception.code), (403, reason))
        with self.assertRaises(fe.ApiError): self.call(first_open=first)
        self.google.integrity['ok'] = self.verdict(nonce)
        self.assertEqual(self.call(first_open=first, integrity={'token': 'ok'})['state'], 'trial')
        self.assertEqual(self.call(first_open=first)['state'], 'trial')          # only checked when first seen

    def test_google_down_does_not_block_and_log_mode_records(self):
        self.make(FT_INTEGRITY_MODE='enforce')
        self.google.down = True
        self.assertEqual(self.call(integrity={'token': 'x'})['state'], 'trial')
        self.make(FT_INTEGRITY_MODE='log')
        self.google.down = False
        self.call(install='install-0002', android='c' * 16)
        db = sqlite3.connect(self.cfg.db)
        self.assertEqual(sorted(r[0] for r in db.execute('SELECT integrity FROM devices')), ['missing', 'unavailable'])

    def test_response_tells_the_app_whether_to_send_integrity(self):
        r = self.svc.entitlement({'installId': 'install-0001', 'androidId': ANDROID_ID, 'firstOpenAt': T0 * 1000})
        self.assertEqual((r['integrity'], r['products']), (False, [PRODUCT]))


class RtdnTests(Base):
    def test_auth(self):
        for auth in ('', 'Bearer bad', 'good', 'Basic good'):
            with self.assertRaises(fe.ApiError) as e: self.rtdn({'testNotification': {}}, auth=auth)
            self.assertEqual(e.exception.status, 401)
        self.svc.verify_oidc = lambda t, a: {'email': 'rtdn@x.iam.gserviceaccount.com', 'email_verified': False}
        with self.assertRaises(fe.ApiError): self.rtdn({'testNotification': {}})

    def test_duplicate_is_not_processed_twice(self):
        self.google.sub('tok', acked=True)
        note = {'subscriptionNotification': {'notificationType': 2, 'purchaseToken': 'tok'}}
        self.assertEqual(self.rtdn(note), 'ok')
        calls = self.google.calls
        self.assertEqual(self.rtdn(note), 'duplicate')
        self.assertEqual(self.google.calls, calls)

    def test_google_down_fails_so_pubsub_retries(self):
        self.google.down = True
        note = {'subscriptionNotification': {'notificationType': 2, 'purchaseToken': 'tok'}}
        with self.assertRaises(fe.GoogleError): self.rtdn(note)
        self.google.down = False
        self.google.sub('tok', acked=True)
        self.assertEqual(self.rtdn(note), 'ok')

    def test_wrong_package_and_test_notification(self):
        data = base64.b64encode(json.dumps({'packageName': 'evil', 'testNotification': {}}).encode()).decode()
        with self.assertRaises(fe.ApiError) as e: self.svc.rtdn({'message': {'data': data, 'messageId': 'x'}}, 'Bearer good')
        self.assertEqual(e.exception.status, 400)
        self.assertEqual(self.rtdn({'testNotification': {'version': '1.0'}}, message_id='t'), 'ok')


class PruneTests(Base):
    def test_retention(self):
        self.google.sub('tok', acked=True, expiry=T0 + 30 * DAY)
        self.call(purchases=['tok'])
        self.rtdn({'voidedPurchaseNotification': {'purchaseToken': 'gone'}})
        self.clock.t = T0 + 401 * DAY
        self.svc._pruned = 0
        self.svc.entitlement({'installId': 'install-0002', 'androidId': 'd' * 16, 'firstOpenAt': self.clock.t * 1000})
        db = sqlite3.connect(self.cfg.db)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM devices').fetchone()[0], 1)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM purchases').fetchone()[0], 0)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM bindings').fetchone()[0], 0)


class HttpTests(Base):
    def test_round_trip(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), fe.make_handler(self.svc))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{server.server_port}'

        def post(path, body, headers=None):
            data = body if isinstance(body, bytes) else json.dumps(body).encode()
            req = urllib.request.Request(base + path, data=data, headers={'Content-Type': 'application/json', **(headers or {})})
            try:
                with urllib.request.urlopen(req) as r: return r.status, r.read()
            except urllib.error.HTTPError as e:
                return e.code, e.read()
        try:
            with urllib.request.urlopen(base + '/healthz') as r: self.assertEqual(r.status, 200)
            status, body = post('/v1/entitlement', {'installId': 'install-0001', 'androidId': ANDROID_ID, 'firstOpenAt': T0 * 1000})
            self.assertEqual(status, 200)
            self.assertEqual(self.ticket(json.loads(body))['state'], 'trial')
            self.assertEqual(post('/v1/entitlement', b'{bad')[0], 400)
            self.assertEqual(post('/v1/entitlement', b'x' * (17 * 1024))[0], 413)
            self.assertEqual(post('/v1/nope', {'a': 1})[0], 404)
            self.assertEqual(post('/v1/rtdn', {'message': {}})[0], 401)
            data = base64.b64encode(json.dumps({'packageName': self.cfg.package, 'testNotification': {}}).encode()).decode()
            self.assertEqual(post('/v1/rtdn', {'message': {'data': data, 'messageId': 'h'}}, {'Authorization': 'Bearer good'})[0], 204)
            self.google.down = True
            data = base64.b64encode(json.dumps({'packageName': self.cfg.package, 'subscriptionNotification': {'purchaseToken': 't'}}).encode()).decode()
            self.assertEqual(post('/v1/rtdn', {'message': {'data': data, 'messageId': 'g'}}, {'Authorization': 'Bearer good'})[0], 500)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
