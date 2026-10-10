/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isParentDatabaseName, isParentDatabaseOid, isParentPostgresError, parentPostgresError } from './parent-postgres-store.js';

const tokenPattern = /^[a-f0-9]{64}$/u;
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const sameToken = (scope, token) => typeof token === 'string' && tokenPattern.test(token)
  && timingSafeEqual(scope.tokenBytes, Buffer.from(token, 'hex'));
const sanitized = (error) => isParentPostgresError(error) ? error : parentPostgresError('fixture_parent_store_failed');

function captureRecord(record) {
  if (!plain(record) || record.version !== 1 || !Number.isSafeInteger(record.pid) || record.pid < 1 || record.pid > 2_147_483_647) {
    throw parentPostgresError('fixture_parent_record_invalid');
  }
  const base = ['version', 'pid', 'action'];
  const keys = record.action === 'reserve' ? [...base, 'kind']
    : record.action === 'abandon' ? [...base, 'databaseName'] : [...base, 'databaseName', 'oid'];
  if (!['reserve', 'commit', 'assert', 'release', 'abandon'].includes(record.action)
    || keys.some((key) => !Object.hasOwn(record, key)) || Reflect.ownKeys(record).some((key) => !keys.includes(key))
    || (record.action === 'reserve' && !['scenario', 'template'].includes(record.kind))
    || (record.action !== 'reserve' && !isParentDatabaseName(record.databaseName))
    || (!['reserve', 'abandon'].includes(record.action) && !isParentDatabaseOid(record.oid))) {
    throw parentPostgresError('fixture_parent_record_invalid');
  }
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, record[key]])));
}

function stats(scope) {
  const entries = [...scope.entries.values()];
  return Object.freeze({ reserved: entries.length, registered: entries.filter((entry) => entry.oid !== null).length,
    released: entries.filter((entry) => entry.released).length, reaped: entries.filter((entry) => entry.reaped).length,
    uncertain: entries.filter((entry) => entry.uncertain).length });
}

export function createParentPostgresRegistry({ store,
  nameFactory = ({ kind }) => `harmoniarr_${kind}_${randomBytes(12).toString('hex')}` } = {}) {
  if (typeof store?.inspect !== 'function' || typeof store?.reap !== 'function' || typeof nameFactory !== 'function') {
    throw new TypeError('Parent PostgreSQL registry requires its identity store and name factory');
  }
  let active = null; let lastFinished = null; let tail = Promise.resolve();
  const enqueue = (operation) => {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    result.catch(() => {});
    return result;
  };
  const ownerScope = (token) => {
    const scope = [active, lastFinished].find((candidate) => candidate && sameToken(candidate, token));
    if (!scope) throw parentPostgresError('fixture_parent_authentication_failed');
    return scope;
  };
  async function inspect(name) {
    const row = await store.inspect(name);
    if (row !== null && (!plain(row) || !isParentDatabaseOid(row.oid) || typeof row.owned !== 'boolean'
      || !Number.isSafeInteger(row.activeCount) || row.activeCount < 0)) throw parentPostgresError('fixture_parent_store_failed');
    return row;
  }
  const assertMatching = async (entry, oid) => {
    const row = await inspect(entry.databaseName);
    if (!row || row.oid !== oid || !row.owned) throw parentPostgresError('fixture_parent_identity_changed');
    return row;
  };

  function beginScope() {
    if (active) throw parentPostgresError('fixture_parent_scope_active');
    const tokenBytes = randomBytes(32); const scopeId = randomUUID();
    active = { scopeId, tokenBytes, admissionOpen: true, revoked: false, entries: new Map(), pids: new Set(), finishPromise: null };
    return Object.freeze({ scopeId, token: tokenBytes.toString('hex') });
  }
  function authenticate(token) { return Boolean(active && !active.revoked && sameToken(active, token)); }

  async function dispatch(token, input) {
    if (!authenticate(token)) throw parentPostgresError('fixture_parent_authentication_failed');
    const scope = active; let record;
    try { record = captureRecord(input); }
    catch (error) { throw isParentPostgresError(error) ? error : parentPostgresError('fixture_parent_record_invalid'); }
    scope.pids.add(record.pid);
    return enqueue(async () => {
      try {
        if (record.action === 'reserve') {
          if (!scope.admissionOpen) throw parentPostgresError('fixture_parent_scope_closed');
          const name = await nameFactory({ scopeId: scope.scopeId, kind: record.kind });
          if (!scope.admissionOpen) throw parentPostgresError('fixture_parent_scope_closed');
          if (!isParentDatabaseName(name)) throw parentPostgresError('fixture_parent_record_invalid');
          if (scope.entries.has(name) || await inspect(name)) throw parentPostgresError('fixture_parent_reservation_collision');
          if (!scope.admissionOpen) throw parentPostgresError('fixture_parent_scope_closed');
          scope.entries.set(name, { databaseName: name, kind: record.kind, pid: record.pid, oid: null,
            abandoned: false, released: false, reaped: false, uncertain: false });
          return { databaseName: name };
        }
        const entry = scope.entries.get(record.databaseName);
        if (!entry || entry.pid !== record.pid) throw parentPostgresError('fixture_parent_unregistered_database');
        if (record.action === 'abandon') {
          if (entry.oid !== null) throw parentPostgresError('fixture_parent_unregistered_database');
          entry.abandoned = true;
          return { abandoned: true };
        }
        if (record.action === 'commit') {
          if (entry.abandoned || entry.released || entry.reaped || (entry.oid !== null && entry.oid !== record.oid)) {
            throw parentPostgresError('fixture_parent_identity_changed');
          }
          await assertMatching(entry, record.oid);
          entry.oid = record.oid;
          return { databaseName: entry.databaseName, oid: entry.oid };
        }
        if (entry.oid !== record.oid || entry.reaped) throw parentPostgresError('fixture_parent_unregistered_database');
        if (record.action === 'assert') {
          if (entry.released) throw parentPostgresError('fixture_parent_unregistered_database');
          await assertMatching(entry, record.oid);
          return { databaseName: entry.databaseName, oid: entry.oid };
        }
        if (await inspect(entry.databaseName)) throw parentPostgresError('fixture_parent_cleanup_incomplete');
        entry.released = true;
        return { released: true };
      } catch (error) { throw sanitized(error); }
    });
  }

  function closeAdmission(token) { ownerScope(token).admissionOpen = false; }
  function workerPids(token) { return [...ownerScope(token).pids].sort((a, b) => a - b); }

  async function finishScope(token, options = {}) {
    const scope = ownerScope(token);
    scope.admissionOpen = false;
    scope.revoked = true;
    let workersQuiescent;
    try {
      if (!plain(options) || Reflect.ownKeys(options).length !== 1 || !Object.hasOwn(options, 'workersQuiescent')) {
        throw parentPostgresError('fixture_parent_record_invalid');
      }
      workersQuiescent = options.workersQuiescent;
      if (typeof workersQuiescent !== 'boolean') throw parentPostgresError('fixture_parent_record_invalid');
    } catch (error) { throw isParentPostgresError(error) ? error : parentPostgresError('fixture_parent_record_invalid'); }
    if (scope.finishPromise) return scope.finishPromise;
    if (!workersQuiescent) return enqueue(() => { throw parentPostgresError('fixture_parent_workers_not_quiescent'); });
    scope.finishPromise = enqueue(async () => {
      let firstError;
      for (const entry of scope.entries.values()) {
        try {
          const row = await inspect(entry.databaseName);
          if (entry.oid === null) {
            if (row) throw parentPostgresError('fixture_parent_database_uncertain');
          } else if (!row) {
            if (!entry.reaped) entry.released = true;
          } else {
            if (entry.released || entry.reaped || row.oid !== entry.oid || !row.owned) {
              throw parentPostgresError('fixture_parent_identity_changed');
            }
            await store.reap(entry.databaseName, entry.oid);
            if (await inspect(entry.databaseName)) throw parentPostgresError('fixture_parent_cleanup_incomplete');
            entry.reaped = true;
          }
        } catch (error) {
          entry.uncertain = true;
          firstError ??= sanitized(error);
        }
      }
      const result = stats(scope);
      if (firstError) {
        Object.defineProperty(firstError, 'stats', { value: result, configurable: true });
        throw firstError;
      }
      lastFinished = scope;
      if (active === scope) active = null;
      return result;
    });
    return scope.finishPromise;
  }

  return { beginScope, authenticate, dispatch, closeAdmission, workerPids, finishScope };
}
