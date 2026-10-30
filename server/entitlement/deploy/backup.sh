#!/bin/sh
set -eu

umask 077

DB_PATH=${FT_ENTITLEMENT_DB_PATH:-/var/lib/ft-entitlement/ft.sqlite3}
BACKUP_DIR=${FT_ENTITLEMENT_BACKUP_DIR:-/var/backups/ft-entitlement}
TODAY=$(date -u +%Y-%m-%d)
DESTINATION=${BACKUP_DIR}/ft-entitlement-${TODAY}.sqlite3

if [ ! -f "$DB_PATH" ]; then
    echo "entitlement database not found: $DB_PATH" >&2
    exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "sqlite3 is required" >&2
    exit 1
fi

install -d -m 0700 "$BACKUP_DIR"
TEMPORARY=$(mktemp "${BACKUP_DIR}/.ft-entitlement-backup.XXXXXX")

cleanup() {
    rm -f -- "$TEMPORARY"
}
trap cleanup EXIT HUP INT TERM

sqlite3 "$DB_PATH" ".timeout 10000" ".backup '$TEMPORARY'"
chmod 0600 "$TEMPORARY"
mv -f -- "$TEMPORARY" "$DESTINATION"
trap - EXIT HUP INT TERM

# Date-formatted names sort newest first, so remove every complete daily backup
# after the newest 14.  The exact filename pattern prevents unrelated deletion.
find "$BACKUP_DIR" -maxdepth 1 -type f \
    -name 'ft-entitlement-????-??-??.sqlite3' -printf '%f\n' \
    | LC_ALL=C sort -r \
    | awk 'NR > 14' \
    | while IFS= read -r OLD_BACKUP; do
        rm -f -- "${BACKUP_DIR}/${OLD_BACKUP}"
    done
