/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

function fixture({ schemaMode, external = false, execute, stop = async () => {} }) {
  const calls = { operations: 0, captures: 0, templates: 0, stops: 0 };
  const runOperation = run => execute(run, calls.operations++);
  return { calls, options: {
    env: external ? { PGPASSWORD: 'controlled' } : {}, schemaMode,
    failureEvidenceFactory: () => ({ createCapture: () => { calls.captures++; return async () => {}; } }),
    createPostgresContainer: () => {
      assert.equal(external, false, 'Borrowed server was acquired');
      return { start: async () => ({
        getDatabase: () => 'controlled', getHost: () => '127.0.0.1', getPort: () => 54321,
        getUsername: () => 'controlled', getPassword: () => 'controlled',
        stop: async () => { calls.stops++; await stop(); },
      }) };
    },
    withTemporaryPostgresDatabaseFn: ({ run }) => runOperation(run),
    createPreparedPostgresTemplateFn: async () => ({ runIsolatedDatabase: runOperation,
      cleanup: async () => { calls.templates++; } }),
  } };
}

for (const schemaMode of ['empty', 'migration_template']) {
  for (const external of [false, true]) {
    test(`${schemaMode} ${external ? 'borrowed' : 'owned'} runtime seals immediately and drains both full delegate tails`, async () => {
      const entered = [Promise.withResolvers(), Promise.withResolvers()];
      const held = [Promise.withResolvers(), Promise.withResolvers()]; let closed = false;
      const f = fixture({ schemaMode, external, execute: (run, index) => withWorkerTaskCleanup(() => run({}), async () => {
        entered[index].resolve(); await held[index].promise;
      }) });
      const runtime = await createPostgresIntegrationRuntime(f.options); const firstValue = Object.freeze({ complete: true });
      const first = runtime.runIsolatedDatabase(async () => firstValue); const second = runtime.runIsolatedDatabase(async () => undefined);
      const pending = Promise.all([first, second]); pending.catch(() => {});
      // Close in the same turn as admission, before a queued delegate can start.
      const closing = runtime.cleanup(); closing.then(() => { closed = true; }, () => { closed = true; });
      try {
        await Promise.all(entered.map(gate => gate.promise)); await turn();
        assert.equal(closed, false); assert.equal(f.calls.stops, 0); assert.equal(f.calls.templates, 0);
        assert.equal(runtime.cleanup(), closing);
        const before = { ...f.calls }; let readLateOptions = false;
        await assert.rejects(runtime.runIsolatedDatabase(() => assert.fail('Late callback ran'), {
          get phaseObserver() { readLateOptions = true; throw null; },
        }), { code: 'fixture_runtime_closed' });
        assert.equal(readLateOptions, false); assert.deepEqual(f.calls, before);
        held[0].resolve(); assert.equal(await first, firstValue); await turn();
        assert.equal(closed, false); assert.equal(f.calls.stops, 0); assert.equal(f.calls.templates, 0);
        held[1].resolve(); assert.equal(await second, undefined); await closing;
        assert.equal(runtime.cleanup(), closing);
        await assert.rejects(runtime.runIsolatedDatabase(() => assert.fail('Closed callback ran')), { code: 'fixture_runtime_closed' });
        assert.deepEqual(f.calls, { operations: 2, captures: 4, templates: schemaMode === 'migration_template' ? 1 : 0, stops: external ? 0 : 1 });
      } finally {
        for (const gate of held) gate.resolve(); await Promise.allSettled([first, second]); await runtime.cleanup().catch(() => {});
      }
    });
  }

  for (const primary of [new Error('controlled-scenario'), null]) {
    test(`${schemaMode} retains scenario ${primary === null ? 'null' : 'Error'} while rejected sibling drainage precedes failed stop`, async () => {
      const entered = [Promise.withResolvers(), Promise.withResolvers()];
      const held = [Promise.withResolvers(), Promise.withResolvers()]; const stopFailure = new Error('controlled-stop'); let closed = false;
      const f = fixture({ schemaMode, stop: async () => { throw stopFailure; },
        execute: (run, index) => withWorkerTaskCleanup(() => run({}), async () => {
          entered[index].resolve(); await held[index].promise;
        }),
      });
      const runtime = await createPostgresIntegrationRuntime(f.options);
      const first = runtime.runIsolatedDatabase(async () => { throw primary; }); first.catch(() => {});
      const second = runtime.runIsolatedDatabase(async () => 'complete'); second.catch(() => {});
      await Promise.all(entered.map(gate => gate.promise));
      const closing = runtime.cleanup(); closing.then(() => { closed = true; }, () => { closed = true; });
      try {
        held[0].resolve(); await assert.rejects(first, error => error === primary); await turn();
        assert.equal(closed, false); assert.equal(f.calls.stops, 0); assert.equal(f.calls.templates, 0);
        held[1].resolve(); assert.equal(await second, 'complete');
        await assert.rejects(closing, error => error === stopFailure);
        assert.equal(runtime.cleanup(), closing); assert.equal(f.calls.stops, 1);
        await assert.rejects(runtime.runIsolatedDatabase(() => assert.fail()), { code: 'fixture_runtime_closed' });
      } finally {
        for (const gate of held) gate.resolve(); await Promise.allSettled([first, second]); await runtime.cleanup().catch(() => {});
      }
    });
  }
}

test('invalid admitted callbacks reject without preventing later canonical cleanup', async () => {
  const f = fixture({ schemaMode: 'empty', execute: () => assert.fail('Invalid callback reached delegate') });
  const runtime = await createPostgresIntegrationRuntime(f.options);
  await assert.rejects(runtime.runIsolatedDatabase(null), TypeError); await runtime.cleanup();
  await assert.rejects(runtime.runIsolatedDatabase(null), { code: 'fixture_runtime_closed' });
  assert.equal(f.calls.operations, 0); assert.equal(f.calls.stops, 1);
});
