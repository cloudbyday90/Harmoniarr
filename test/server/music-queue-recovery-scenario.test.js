/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withMusicQueueRecoveryScenario } from '../../testing/integration/music-queue-recovery-scenario.js';
import { prepareLibraryTestSchema } from '../../testing/integration/library-test-schema-preparation.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

function fixture(prepare = async () => {}) {
  const records = []; const calls = []; const controller = new AbortController(); const pool = {};
  const getPoolFn = () => pool; const databaseConfig = { password: 'private-password' }; const databaseName = 'private-name';
  const phaseObserver = createFixturePhaseObserver({ onRecord: record => records.push(record) });
  return { records, calls, controller, pool, getPoolFn, databaseConfig, databaseName,
    runtime: { runIsolatedDatabase: async (run, options) => {
      assert.equal(options.signal, controller.signal); calls.push('database');
      return run({ getPoolFn, databaseConfig, databaseName, phaseObserver });
    } }, t: { signal: controller.signal },
    dependencies: { prepareSchema: input => {
      assert.equal(input.getPoolFn, getPoolFn); assert.equal(input.signal, controller.signal);
      return prepareLibraryTestSchema({ ...input, applyPendingMigrationsFn: async options => {
        assert.equal(options.getPoolFn, getPoolFn); calls.push('prepare'); return prepare();
      } });
    }, createContext: input => { assert.equal(input.getPoolFn, getPoolFn); calls.push('context'); return { pool }; } },
  };
}
test('recovery adapter binds current database/pool/signal and measures actual preparation and complete callback', async () => {
  const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); const f = fixture(); let settled = false;
  const pending = withMusicQueueRecoveryScenario(f.runtime, f.t, async context => {
    assert.equal(context.pool, f.pool); assert.equal(context.databaseConfig, f.databaseConfig);
    assert.equal(context.databaseName, f.databaseName); entered.resolve(); await hold.promise; return 42;
  }, f.dependencies);
  const observed = pending.then(() => { settled = true; }, () => { settled = true; });
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending }); assert.equal(settled, false);
    assert.deepEqual(f.calls, ['database', 'prepare', 'context']); assert.equal(f.records.length, 1);
    hold.resolve(); assert.equal(await pending, 42);
    assert.deepEqual(f.records.map(record => [record.phase, record.outcome]), [['schema_prepare', 'passed'], ['scenario_work', 'passed']]);
    assert.equal(JSON.stringify(f.records).includes('private-'), false);
  } finally { hold.resolve(); await observed; }
});
for (const primary of [new Error('controlled'), null]) {
  for (const stage of ['prepare', 'scenario']) test(`${stage} retains ${primary === null ? 'null' : 'Error'} and awaits its returned work`, async () => {
    const entered = Promise.withResolvers(); const hold = Promise.withResolvers(); let settled = false;
    const fail = async () => { entered.resolve(); await hold.promise; throw primary; };
    const f = fixture(stage === 'prepare' ? fail : async () => {});
    const pending = withMusicQueueRecoveryScenario(f.runtime, f.t, stage === 'scenario' ? fail : () => assert.fail('Failed preparation entered scenario'), f.dependencies);
    const observed = pending.then(() => { settled = true; }, () => { settled = true; });
    try {
      await waitForFixtureReady({ ready: entered.promise, operation: pending }); assert.equal(settled, false);
      hold.resolve(); await assert.rejects(pending, error => error === primary);
      assert.equal(f.calls.includes('context'), stage === 'scenario'); assert.equal(f.records.at(-1).outcome, 'failed');
    } finally { hold.resolve(); await observed; }
  });
  test(`cancellation during preparation waits for real completion before exact ${primary === null ? 'null' : 'Error'} and no context`, async () => {
    const entered = Promise.withResolvers(); const hold = Promise.withResolvers();
    const f = fixture(async () => { entered.resolve(); await hold.promise; }); let settled = false;
    const pending = withMusicQueueRecoveryScenario(f.runtime, f.t, () => assert.fail('Cancelled preparation invoked scenario'), f.dependencies);
    const observed = pending.then(() => { settled = true; }, () => { settled = true; });
    try {
      await waitForFixtureReady({ ready: entered.promise, operation: pending }); f.controller.abort(primary);
      await Promise.resolve(); assert.equal(settled, false); hold.resolve(); await assert.rejects(pending, error => error === primary);
      assert.equal(f.calls.includes('context'), false); assert.equal(f.records.length, 1);
    } finally { hold.resolve(); await observed; }
  });
}
test('invalid recovery callback/dependency refuses before database admission', async () => {
  const f = fixture();
  await assert.rejects(withMusicQueueRecoveryScenario(f.runtime, f.t, null, f.dependencies), TypeError);
  await assert.rejects(withMusicQueueRecoveryScenario(f.runtime, f.t, () => {}, { prepareSchema: null }), TypeError);
  assert.deepEqual(f.calls, []);
});
