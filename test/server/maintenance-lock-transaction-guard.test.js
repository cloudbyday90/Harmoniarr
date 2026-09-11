/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';

test('transactional maintenance guard acquires its fence on the read client before checking active locks', async () => {
  const statements = [];
  const queryable = { async query(sql) { statements.push(sql); return { rows: [] }; } };
  const service = createMaintenanceLockService({ getPoolFn: () => { throw new Error('Must use the caller transaction'); } });
  assert.deepEqual(await service.listActiveMaintenanceLocks({ queryable, lockForTransaction: true }), []);
  assert.equal(statements[0], 'LOCK TABLE maintenance_locks IN SHARE MODE');
  assert.match(statements[1], /SELECT.*[\s\S]*FROM maintenance_locks/u);
});

test('maintenance status reads stay unlocked, including reads on an existing transaction', async () => {
  const statements = [];
  const queryable = { async query(sql) { statements.push(sql); return { rows: [] }; } };
  const service = createMaintenanceLockService({ getPoolFn: () => queryable });
  await service.listActiveMaintenanceLocks();
  await service.listActiveMaintenanceLocks({ queryable });
  assert.equal(statements.length, 2);
  assert.ok(statements.every((sql) => !sql.includes('LOCK TABLE')));
});

test('a requested transaction fence cannot silently fall back to a pool query', async () => {
  const service = createMaintenanceLockService({ getPoolFn: () => { throw new Error('Unexpected pool lookup'); } });
  await assert.rejects(service.listActiveMaintenanceLocks({ lockForTransaction: true }), /transaction client is required/u);
});
