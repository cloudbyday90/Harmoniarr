/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStartupMigrationStateCurrent } from '../../src/server/startup-migration-validation-service.js';
import { startServerRuntime } from '../../src/server/startup-runtime.js';

const current = () => ({ current: true, repoCount: 1, pending: [], unknownApplied: [], checksumDrift: [], migrationKeyDrift: [], nonAppliedRows: [] });

test('startup lineage validation uses the supplied pool owner once and returns current state', async () => {
  const getPoolFn = () => { throw new Error('observer owns checkout'); };
  const report = current();
  let calls = 0;
  assert.equal(await assertStartupMigrationStateCurrent({ getPoolFn, inspectDatabaseMigrationStateFn: async options => {
    calls++;
    assert.deepEqual(options, { getPoolFn });
    return report;
  } }), report);
  assert.equal(calls, 1);
});

test('each inconsistent lineage category refuses startup with bounded guidance and no stored diagnostic data', async () => {
  const privateText = 'private-ledger-filename-error-checksum';
  for (const field of ['pending', 'unknownApplied', 'checksumDrift', 'migrationKeyDrift', 'nonAppliedRows']) {
    const report = { ...current(), current: false, [field]: [{ filename: privateText, errorMessage: privateText, storedChecksum: privateText }] };
    await assert.rejects(assertStartupMigrationStateCurrent({ inspectDatabaseMigrationStateFn: async () => report }), error => {
      assert.equal(error.code, 'startup_migration_lineage_invalid');
      assert.match(error.message, /Startup migration validation failed:/u);
      assert.match(error.message, /npm run diagnose:migrations/u);
      assert.match(error.message, /do not rewrite ledger checksums/u);
      assert.doesNotMatch(error.message, new RegExp(privateText, 'u'));
      assert.ok(error.message.length < 650);
      return true;
    });
  }
});

test('startup lineage observation failures preserve Error and null without retrying', async () => {
  for (const original of [new Error('unavailable'), null]) {
    let calls = 0;
    await assert.rejects(assertStartupMigrationStateCurrent({ inspectDatabaseMigrationStateFn: async () => {
      calls++;
      throw original;
    } }), error => error === original);
    assert.equal(calls, 1);
  }
});

test('an empty repository manifest cannot certify startup even with an empty matching ledger', async () => {
  await assert.rejects(assertStartupMigrationStateCurrent({
    inspectDatabaseMigrationStateFn: async () => ({ ...current(), repoCount: 0 }),
  }), /Startup migration validation failed:.*0 repo migration\(s\)/u);
});

test('startup refuses lineage before path validation, app composition, listening or recovery ownership', async () => {
  for (const original of [new Error('lineage rejected'), null]) {
    const events = [];
    const getPool = () => { throw new Error('injected owner'); };
    await assert.rejects(startServerRuntime({
      getPool,
      bootstrapDatabaseSchemaFromSnapshot: async options => {
        assert.equal(options.getPoolFn, getPool);
        events.push('bootstrap');
        return { bootstrapped: false };
      },
      assertStartupMigrationStateCurrent: async options => {
        assert.equal(options.getPoolFn, getPool);
        events.push('lineage');
        throw original;
      },
      createStartupValidationService: () => { events.push('paths'); throw new Error('unexpected path validation'); },
      createApp: () => { events.push('app'); throw new Error('unexpected composition'); },
    }), error => error === original);
    assert.deepEqual(events, ['bootstrap', 'lineage']);
  }
});
