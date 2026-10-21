#!/usr/bin/env bash
# Runs the migration + two-account RLS tests against a scratch local Postgres (NOT your Supabase project).
# Usage: PGHOST=... PGUSER=postgres ./supabase/tests/run.sh   (needs a role that can CREATE DATABASE)
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=cosmos_rls_test
psql -qc "drop database if exists $DB" -c "create database $DB"
psql -q -d $DB -v ON_ERROR_STOP=1 -f supabase/tests/auth_stub.sql $(for f in supabase/migrations/*.sql; do printf -- "-f %s " "$f"; done)
psql -q -d $DB -f supabase/tests/rls_test.sql 2>&1 | grep -E "PASS|FAIL" | sed 's/^.*NOTICE:  //' | tee /tmp/rls.out
! grep -q FAIL /tmp/rls.out
