#!/bin/sh
set -eu

log() {
  printf '%s %s\n' "[harmoniarr-entrypoint]" "$*"
}

find_bin() {
  name="$1"
  for candidate in \
    "$(command -v "$name" 2>/dev/null || true)" \
    "/usr/lib/postgresql18/bin/$name" \
    "/usr/libexec/postgresql/$name" \
    "/usr/libexec/postgresql18/$name" \
    "/usr/bin/$name"
  do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

require_integer() {
  name="$1"
  value="$2"
  case "$value" in
    ''|*[!0-9]*)
      log "invalid numeric value for ${name}: ${value}"
      exit 64
      ;;
  esac
}

require_identifier() {
  name="$1"
  value="$2"
  case "$value" in
    ''|*[!A-Za-z0-9_-]*)
      log "invalid identifier for ${name}: ${value}"
      exit 64
      ;;
  esac
}

require_supported_architecture() {
  machine="$(uname -m 2>/dev/null || printf 'unknown')"
  case "$machine" in
    x86_64|amd64|aarch64|arm64)
      ;;
    *)
      log "unsupported CPU architecture ${machine}; Harmoniarr requires a 64-bit amd64 or arm64 runtime"
      exit 64
      ;;
  esac
}

stop_postgres() {
  if [ -n "${PG_CTL_BIN:-}" ] && [ -d "$PGDATA" ]; then
    "$PG_CTL_BIN" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
}

cleanup_and_exit() {
  signal_exit_code="$1"
  if [ -n "${app_pid:-}" ]; then
    kill "$app_pid" >/dev/null 2>&1 || true
    wait "$app_pid" 2>/dev/null || true
  fi

  stop_postgres
  exit "$signal_exit_code"
}

APP_PORT="${APP_PORT:-3000}"
UMASK_VALUE="${UMASK:-0022}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-harmoniarr}"
POSTGRES_MAINTENANCE_DB="${POSTGRES_MAINTENANCE_DB:-template1}"
POSTGRES_USER="${POSTGRES_USER:-harmoniarr}"
PGDATA="${PGDATA:-/app/data/postgres/18/data}"

require_supported_architecture
require_integer APP_PORT "$APP_PORT"
require_integer POSTGRES_PORT "$POSTGRES_PORT"
require_identifier POSTGRES_DB "$POSTGRES_DB"
require_identifier POSTGRES_MAINTENANCE_DB "$POSTGRES_MAINTENANCE_DB"
require_identifier POSTGRES_USER "$POSTGRES_USER"

umask "$UMASK_VALUE"

mkdir -p \
  /app/data \
  "$PGDATA" \
  /data/downloads \
  /data/music \
  /data/staging \
  /data/transcode-temp \
  /run/postgresql \
  /tmp

if [ "$#" -eq 0 ] || { [ "$#" -eq 1 ] && [ "$1" = "placeholder-runtime" ]; }; then
  set -- node /app/server-dist/index.js
fi

INITDB_BIN="$(find_bin initdb || true)"
PG_CTL_BIN="$(find_bin pg_ctl || true)"
PG_ISREADY_BIN="$(find_bin pg_isready || true)"
PSQL_BIN="$(find_bin psql || true)"
CREATEDB_BIN="$(find_bin createdb || true)"

if [ -z "$INITDB_BIN" ] || [ -z "$PG_CTL_BIN" ] || [ -z "$PG_ISREADY_BIN" ] || [ -z "$PSQL_BIN" ] || [ -z "$CREATEDB_BIN" ]; then
  log "embedded PostgreSQL binaries are missing from the runtime image"
  exit 69
fi

export PGHOST=127.0.0.1
export PGPORT="$POSTGRES_PORT"
export PGUSER="$POSTGRES_USER"
export PGDATABASE="$POSTGRES_DB"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  log "initializing embedded PostgreSQL cluster at $PGDATA"
  "$INITDB_BIN" -D "$PGDATA" --username="$POSTGRES_USER" --auth-local=trust --auth-host=trust >/dev/null

  cat > "$PGDATA/pg_hba.conf" <<EOF
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
EOF
fi

trap 'cleanup_and_exit 143' INT TERM

log "starting embedded PostgreSQL on 127.0.0.1:${POSTGRES_PORT}"
"$PG_CTL_BIN" -D "$PGDATA" -w start -o "-c listen_addresses=127.0.0.1 -c port=${POSTGRES_PORT} -c unix_socket_directories=/run/postgresql" >/dev/null

if ! "$PG_ISREADY_BIN" -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" >/dev/null 2>&1; then
  log "embedded PostgreSQL did not become ready"
  stop_postgres
  exit 70
fi

if ! "$PSQL_BIN" -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_MAINTENANCE_DB" -Atqc "SELECT datname FROM pg_database WHERE datname = '${POSTGRES_DB}'" | grep -Fxq "$POSTGRES_DB"; then
  log "creating application database ${POSTGRES_DB}"
  "$CREATEDB_BIN" -h 127.0.0.1 -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB"
fi

log "preparing database state"
node /app/server-dist/prepare-database.js

log "starting application command: $*"
"$@" &
app_pid="$!"
wait "$app_pid"
app_exit="$?"

stop_postgres
exit "$app_exit"
