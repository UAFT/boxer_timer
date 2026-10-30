# Fight Tech entitlement server deployment

These files are deployment templates. They do not contain secrets and must not
be used to run more than one entitlement-server process against the same SQLite
database. The examples assume:

- `ft_entitlement.py` is installed at
  `/opt/ft-entitlement/ft_entitlement.py`;
- the service runs as the dedicated, non-login `ft-entitlement` user;
- mutable state is kept in `/var/lib/ft-entitlement`;
- private configuration is kept outside the checkout in
  `/etc/ft-entitlement`.

## Runtime user and directories

Create the account and directories once:

```sh
sudo groupadd --system ft-entitlement
sudo useradd --system --gid ft-entitlement --home-dir /nonexistent \
  --shell /usr/sbin/nologin ft-entitlement
sudo install -d -o root -g root -m 0755 /opt/ft-entitlement
sudo install -d -o ft-entitlement -g ft-entitlement -m 0700 /etc/ft-entitlement
sudo install -d -o ft-entitlement -g ft-entitlement -m 0700 /var/lib/ft-entitlement
sudo install -o root -g root -m 0644 ../ft_entitlement.py /opt/ft-entitlement/ft_entitlement.py
```

The SQLite database is created with mode `0600` by the service's `UMask`. Do
not put a database, purchase token, private key, pepper, or service-account JSON
in the repository.

## Secrets and signing key

The three secret files are:

| File | Purpose |
| --- | --- |
| `/etc/ft-entitlement/signing.pem` | ECDSA P-256 ticket-signing private key |
| `/etc/ft-entitlement/pepper` | random input to the device-key HMAC |
| `/etc/ft-entitlement/google-sa.json` | Google Play/Integrity service-account credentials |

Every secret must be owned by `ft-entitlement:ft-entitlement` and have mode
`0600`.

**Current key (2026-10-30):** the signing key and pepper already exist on this server in
`/home/uaft/.config/ft-entitlement/` (mode 600, never in git). Its public key is the one in
`app/js/billing/config.js` (`ticketKeys`). Copy those two files to `/etc/ft-entitlement/`
instead of generating new ones; a new key needs an app update that lists it in `ticketKeys`
first. Replacing the pepper restarts every trial, so it is never rotated.

Only for a deliberate rotation, generate a new signing key and pepper on the target host:

```sh
sudo -u ft-entitlement openssl ecparam -name prime256v1 -genkey -noout \
  -out /etc/ft-entitlement/signing.pem
sudo -u ft-entitlement sh -c 'umask 077; openssl rand -hex 32 > /etc/ft-entitlement/pepper'
sudo install -o ft-entitlement -g ft-entitlement -m 0600 /secure/source/google-sa.json \
  /etc/ft-entitlement/google-sa.json
sudo chown ft-entitlement:ft-entitlement \
  /etc/ft-entitlement/signing.pem /etc/ft-entitlement/pepper
sudo chmod 0600 /etc/ft-entitlement/signing.pem /etc/ft-entitlement/pepper \
  /etc/ft-entitlement/google-sa.json
```

Extract the public key and put that public key, never `signing.pem`, into the
application's ticket-verification configuration:

```sh
sudo openssl pkey -in /etc/ft-entitlement/signing.pem -pubout \
  -out ./signing-public.pem
```

Back up the signing key and pepper in the project's approved secret store. A
replacement signing key invalidates every ticket already issued.

## Environment

The systemd unit reads `/etc/ft-entitlement/environment`. It is ordinary
configuration (do not put secret contents in it); private values are referenced
by file path. A production example is:

```ini
FT_DB=/var/lib/ft-entitlement/ft.sqlite3
FT_PACKAGE=com.andarfighttech.boxertimer
FT_PRODUCTS='{"fighttech_base":["base"]}'
FT_MAX_DEVICES_PER_PURCHASE=5
FT_INTEGRITY_MODE=log
FT_CLOUD_PROJECT_NUMBER=123456789012
FT_RTDN_AUDIENCE=https://andarfighttech.com/ft-api/v1/rtdn
FT_RTDN_SERVICE_ACCOUNT=play-rtdn@example-project.iam.gserviceaccount.com
FT_BIND=127.0.0.1:8805
FT_PEPPER_FILE=/etc/ft-entitlement/pepper
FT_SIGNING_KEY_FILE=/etc/ft-entitlement/signing.pem
FT_GOOGLE_SERVICE_ACCOUNT_FILE=/etc/ft-entitlement/google-sa.json
```

Install it as root-owned mode `0644`; it contains identifiers and paths, not
credentials. The variables understood by the server are:

| Variable | Meaning / default |
| --- | --- |
| `FT_DB` | SQLite path; `/var/lib/ft-entitlement/ft.sqlite3` |
| `FT_PACKAGE` | Android package; `com.andarfighttech.boxertimer` |
| `FT_PRODUCTS` | required JSON object mapping allowed product IDs to entitlements; default `{}` |
| `FT_MAX_DEVICES_PER_PURCHASE` | device limit per purchase; `5` |
| `FT_INTEGRITY_MODE` | `off`, `log`, or `enforce`; `off` |
| `FT_CLOUD_PROJECT_NUMBER` | numeric Cloud project number returned to clients |
| `FT_RTDN_AUDIENCE` | exact OIDC audience configured on the Pub/Sub push subscription |
| `FT_RTDN_SERVICE_ACCOUNT` | exact verified e-mail allowed to push RTDN messages |
| `FT_BIND` | listener; keep it private at `127.0.0.1:8805` |
| `FT_PEPPER_FILE` | pepper path; `/etc/ft-entitlement/pepper` |
| `FT_SIGNING_KEY_FILE` | signing-key path; `/etc/ft-entitlement/signing.pem` |
| `FT_GOOGLE_SERVICE_ACCOUNT_FILE` | service-account JSON path; must be set for billing and Integrity |

Begin staging with `FT_INTEGRITY_MODE=log`. Change it to `enforce` only after a
Play-installed staging build has produced an `ok` verdict and missing/bad token
behaviour has been checked.

## Staging run

Before installing the unit, run the exact production executable and files as
the service account. Stop this foreground process before starting systemd:

```sh
sudo -u ft-entitlement env \
  FT_DB=/var/lib/ft-entitlement/ft.sqlite3 \
  FT_PACKAGE=com.andarfighttech.boxertimer \
  'FT_PRODUCTS={"fighttech_base":["base"]}' \
  FT_INTEGRITY_MODE=log \
  FT_CLOUD_PROJECT_NUMBER=123456789012 \
  FT_RTDN_AUDIENCE=https://andarfighttech.com/ft-api/v1/rtdn \
  FT_RTDN_SERVICE_ACCOUNT=play-rtdn@example-project.iam.gserviceaccount.com \
  FT_BIND=127.0.0.1:8805 \
  FT_PEPPER_FILE=/etc/ft-entitlement/pepper \
  FT_SIGNING_KEY_FILE=/etc/ft-entitlement/signing.pem \
  FT_GOOGLE_SERVICE_ACCOUNT_FILE=/etc/ft-entitlement/google-sa.json \
  /usr/bin/python3 -B /opt/ft-entitlement/ft_entitlement.py
```

From another shell, `curl --fail http://127.0.0.1:8805/healthz` must return
`{"ok": true}`. Then install `ft-entitlement.service`, reload systemd, and start
the unit:

```sh
sudo install -o root -g root -m 0644 ft-entitlement.service \
  /etc/systemd/system/ft-entitlement.service
sudo systemctl daemon-reload
sudo systemctl enable --now ft-entitlement.service
```

Merge the two clearly marked sections of `nginx-ft-api.conf` into the existing
nginx `http` and HTTPS `server` contexts respectively; check with `nginx -t`
before reloading nginx.

## Backups and rollback

Run `backup.sh` as root once per day (cron or a systemd timer). It uses SQLite's
online `.backup` command, writes root-only files under
`/var/backups/ft-entitlement`, and retains the newest 14 daily copies. Monitor
the job: a successful command with no usable backup is not an acceptable
backup policy.

For example, install it as `/usr/local/sbin/ft-entitlement-backup` mode `0755`
and schedule this root cron entry:

```cron
17 3 * * * root /usr/local/sbin/ft-entitlement-backup
```

To roll back, stop the unit first and restore a database backup while it is
stopped. Preserve the failed database and its WAL files for investigation:

```sh
sudo systemctl stop ft-entitlement.service
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo mv /var/lib/ft-entitlement/ft.sqlite3 \
  "/var/lib/ft-entitlement/ft.sqlite3.failed-${stamp}"
sudo test ! -e /var/lib/ft-entitlement/ft.sqlite3-wal || sudo mv \
  /var/lib/ft-entitlement/ft.sqlite3-wal \
  "/var/lib/ft-entitlement/ft.sqlite3-wal.failed-${stamp}"
sudo test ! -e /var/lib/ft-entitlement/ft.sqlite3-shm || sudo mv \
  /var/lib/ft-entitlement/ft.sqlite3-shm \
  "/var/lib/ft-entitlement/ft.sqlite3-shm.failed-${stamp}"
sudo install -o ft-entitlement -g ft-entitlement -m 0600 \
  /var/backups/ft-entitlement/ft-entitlement-YYYY-MM-DD.sqlite3 \
  /var/lib/ft-entitlement/ft.sqlite3
sudo systemctl start ft-entitlement.service
curl --fail http://127.0.0.1:8805/healthz
```

Restore the matching application version before restarting if the rollback is
also reverting a schema migration.
