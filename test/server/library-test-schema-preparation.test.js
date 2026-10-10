/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { prepareLibraryTestSchema } from '../../testing/integration/library-test-schema-preparation.js';

test('preparation binds the actual migration call to the scenario pool and returns its idempotent result', async () => {
  const records = []; const pool = {}; const getPoolFn = () => pool; const result = [];
  assert.equal(await prepareLibraryTestSchema({ getPoolFn,
    phaseObserver: createFixturePhaseObserver({ onRecord: (record) => records.push(record) }),
    applyPendingMigrationsFn: async (options) => { assert.deepEqual(Object.keys(options), ['getPoolFn']);
      assert.equal(options.getPoolFn, getPoolFn); assert.equal(options.getPoolFn(), pool); return result; },
  }), result);
  assert.equal(records.length, 1); assert.equal(records[0].outcome, 'passed');
});
test('a missing scenario pool is refused before migration work and never falls back to globals', async () => {
  let started = false;
  await assert.rejects(prepareLibraryTestSchema({ phaseObserver: createFixturePhaseObserver(),
    applyPendingMigrationsFn: async () => { started = true; } }), TypeError);
  assert.equal(started, false);
});
test('cancelled preparation awaits actual query settlement and preserves an original SQL failure', async () => {
  const controller = new AbortController(); const started = createFixtureGate(); const hold = createFixtureGate();
  const failure = new Error('Controlled migration query failure'); let settled = false;
  const operation = prepareLibraryTestSchema({ getPoolFn: () => ({}), signal: controller.signal,
    phaseObserver: createFixturePhaseObserver(), applyPendingMigrationsFn: async () => { started.release();
      await hold.promise; throw failure; } });
  operation.then(() => { settled = true; }, () => { settled = true; });
  await started.promise; controller.abort(null); await setImmediate(); assert.equal(settled, false);
  hold.release(); await assert.rejects(operation, (error) => error === failure);
});
test('pre-abort starts no query while post-query cancellation retains null and failed timing evidence', async () => {
  const controller = new AbortController(); controller.abort(null); let started = 0;
  await prepareLibraryTestSchema({ getPoolFn: () => ({}), signal: controller.signal,
    phaseObserver: createFixturePhaseObserver(), applyPendingMigrationsFn: async () => { started += 1; } })
    .then(() => assert.fail('Pre-abort was ignored'), (error) => assert.equal(error, null));
  assert.equal(started, 0);
  const after = new AbortController(); const records = [];
  await prepareLibraryTestSchema({ getPoolFn: () => ({}), signal: after.signal,
    phaseObserver: createFixturePhaseObserver({ onRecord: (record) => records.push(record) }),
    applyPendingMigrationsFn: async () => { after.abort(null); return []; } })
    .then(() => assert.fail('Post-query cancellation was ignored'), (error) => assert.equal(error, null));
  assert.equal(records[0].outcome, 'failed');
});
test('optional timing observation cannot replace a successful migration result or expose credentials', async () => {
  const result = ['controlled.sql']; const pool = { password: 'private-password' }; const records = [];
  assert.equal(await prepareLibraryTestSchema({ getPoolFn: () => pool,
    phaseObserver: createFixturePhaseObserver({ onRecord: (record) => { records.push(record); throw new Error('Observer failure'); } }),
    applyPendingMigrationsFn: async () => result }), result);
  assert.equal(JSON.stringify(records).includes('private-password'), false);
});
