/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';

const errors = new WeakSet();
const codes = new Set(['fixture_parent_invalid', 'fixture_parent_store_failed', 'fixture_parent_identity_changed',
  'fixture_parent_cleanup_incomplete', 'fixture_parent_authentication_failed', 'fixture_parent_scope_active',
  'fixture_parent_scope_closed', 'fixture_parent_record_invalid', 'fixture_parent_reservation_collision',
  'fixture_parent_unregistered_database', 'fixture_parent_database_uncertain', 'fixture_parent_workers_not_quiescent']);

export function parentPostgresError(code = 'fixture_parent_invalid') {
  const error = new Error('The owned PostgreSQL test scope is unavailable or invalid');
  Object.defineProperty(error, 'message', { value: error.message, writable: false, configurable: false });
  Object.defineProperty(error, 'code', { value: codes.has(code) ? code : 'fixture_parent_invalid', enumerable: true });
  errors.add(error);
  return error;
}

export function isParentPostgresError(error) { return errors.has(error); }

export function isParentDatabaseName(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,62}$/u.test(value);
}

export function isParentDatabaseOid(value) {
  return typeof value === 'string' && /^[1-9]\d{0,9}$/u.test(value) && Number(value) <= 4_294_967_295;
}

function identifier(name) {
  if (!isParentDatabaseName(name)) throw parentPostgresError();
  return `"${name}"`;
}

export function createParentPostgresStore({ adminClient } = {}) {
  if (typeof adminClient?.query !== 'function') throw new TypeError('Parent PostgreSQL store requires its maintenance client');
  async function query(sql, values) {
    try { return await adminClient.query(sql, values); }
    catch (error) { throw isParentPostgresError(error) ? error : parentPostgresError('fixture_parent_store_failed'); }
  }

  async function inspect(name) {
    identifier(name);
    const result = await query(`SELECT d.oid::text AS oid,
      d.datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned,
      (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datid=d.oid) AS active_count
      FROM pg_database d WHERE datname=$1`, [name]);
    if (!Array.isArray(result?.rows) || result.rows.length > 1) throw parentPostgresError('fixture_parent_store_failed');
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    if (!isParentDatabaseOid(row?.oid) || typeof row.owned !== 'boolean'
      || !Number.isSafeInteger(row.active_count) || row.active_count < 0) throw parentPostgresError('fixture_parent_store_failed');
    return Object.freeze({ oid: row.oid, owned: row.owned, activeCount: row.active_count });
  }

  async function matching(name, oid) {
    const row = await inspect(name);
    if (!row || row.oid !== oid || row.owned !== true) throw parentPostgresError('fixture_parent_identity_changed');
    return row;
  }

  async function reap(name, oid) {
    const quoted = identifier(name);
    if (!isParentDatabaseOid(oid)) throw parentPostgresError();
    const initial = await inspect(name);
    if (!initial) return;
    if (initial.oid !== oid || !initial.owned) throw parentPostgresError('fixture_parent_identity_changed');
    await query(`ALTER DATABASE ${quoted} ALLOW_CONNECTIONS false`);
    const started = performance.now();
    while (true) {
      const current = await matching(name, oid);
      if (current.activeCount === 0) break;
      if (performance.now() - started >= 5000) throw parentPostgresError('fixture_parent_cleanup_incomplete');
      // Target the acknowledged OID, never sessions in a replacement database
      // that happens to reuse the reserved name.
      await query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datid=$1::oid AND pid<>pg_backend_pid()`, [oid]);
      await pause(50);
    }
    const final = await matching(name, oid);
    if (final.activeCount !== 0) throw parentPostgresError('fixture_parent_cleanup_incomplete');
    await query(`DROP DATABASE ${quoted}`);
    if (await inspect(name)) throw parentPostgresError('fixture_parent_cleanup_incomplete');
  }

  return { inspect, reap };
}
