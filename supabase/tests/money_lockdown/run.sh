#!/usr/bin/env bash
# Runs the money-lockdown migration tests against a throwaway local Postgres
# (no Docker or Supabase stack needed). Applies a stub of the relevant schema
# (stub.sql), then:
#   1. part 1 only            → intermediate_tests.sql (current app still works)
#   2. part 1 + part 2, twice → lockdown_tests.sql     (migrations re-runnable)
# Exits non-zero if any check fails.
#
# Usage: supabase/tests/money_lockdown/run.sh
# Needs Postgres 14+ binaries; set PG_BIN if initdb isn't on PATH.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../../migrations"
PART1="$MIGRATIONS/202610270001_payment_settlement_functions.sql"
PART2="$MIGRATIONS/202610270002_lock_down_money_paths.sql"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb || echo /opt/homebrew/opt/postgresql@14/bin/initdb)")}"
PORT="${PORT:-54329}"
DATA="$(mktemp -d)"

cleanup() { "$PG_BIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k ''" -l "$DATA/pg.log" -w start >/dev/null

psql_q() { psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@" 2>&1 | grep -v NOTICE || true; }
apply() { psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -d "$1" -f "$2" >/dev/null 2>&1 || { echo "FAILED applying $2"; exit 1; }; }
run_tests() { psql -h 127.0.0.1 -p "$PORT" -U postgres -d "$1" -f "$2" 2>&1 | grep -oE '(PASS|FAIL) .*|ERROR: .*'; }

results=""

createdb -h 127.0.0.1 -p "$PORT" -U postgres step1
apply step1 "$HERE/stub.sql"
apply step1 "$PART1"
apply step1 "$PART1"
results+="$(run_tests step1 "$HERE/intermediate_tests.sql")"$'\n'

createdb -h 127.0.0.1 -p "$PORT" -U postgres full
apply full "$HERE/stub.sql"
for _ in 1 2; do apply full "$PART1"; apply full "$PART2"; done
results+="$(run_tests full "$HERE/lockdown_tests.sql")"

echo "$results"
pass=$(grep -c '^PASS' <<<"$results" || true)
fail=$(grep -cE '^(FAIL|ERROR)' <<<"$results" || true)
echo "---- $pass passed, $fail failed"
[ "$fail" -eq 0 ]
